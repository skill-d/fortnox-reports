console.log('Javascript Loaded');

/* Get UI Components */
const generalReportInput = document.getElementById('generalReport');
const annualReportInput = document.getElementById('annualReport');
const generateReportButton = document.getElementById('generate');
const errorMessage = document.getElementById('error-message');

let generalLedger, annualReport;

/* Disable Generate Button */
generateReportButton.setAttribute('disabled', true)

function validateAndProcess() {
    const reader1 = new FileReader();
    const reader2 = new FileReader();
    let genL, resR;

    if (generalLedger) {
        reader1.readAsText(generalLedger);
        reader1.onload = function (c) {
            genL = new GeneralLedger(c.target.result)
            if (!genL.isValid) handleError('The General ledger File is invalid')
            generalLedger = undefined;
        }
    }

    if (annualReport) {
        reader2.readAsText(annualReport);

        reader2.onload = function (c) {
            resR = new ResultReport(c.target.result)
            if (!resR.isValid) handleError('The Result Report File is invalid')
            annualReport = undefined;
        }
    }
}

function handleError(errorString) {
    errorMessage.innerText = errorString
    generateReportButton.setAttribute('disabled', true)
}

function handleFiles(files, fileType) {
    switch (fileType) {
        case 'annual':
            const afileName = document.getElementById('annualReportFileName');
            afileName.innerText = files[0].name + ": " + Math.round(files[0].size / 1024) + " KB";
            annualReport = files[0];
            break;
        case 'general':
            const gfileName = document.getElementById('generalReportFileName');
            gfileName.innerText = files[0].name + ": " + Math.round(files[0].size / 1024) + " KB";
            generalLedger = files[0];
            break;
    }

    if (generalLedger) generateReportButton.removeAttribute('disabled')
}

/* Attach Event Listeners */
generateReportButton.addEventListener('click', validateAndProcess);

class GeneralLedger {
    constructor(file) {
        this.generalLedger = file;
        this._accountBlocks = [];
        this.parseFile();
        this.validate();
        this.secondaryParse();
    }

    parseFile() {
        let accountBlocks = [];
        this.generalLedgerLines = this.generalLedger.split('\n');
        this.generalLedgerLines.forEach((line, index) => {
            if (index < 7) return; // Ignore the first 7 lines as they are the header
            if (line.substr(0, 5) === '-----') accountBlocks.push(index);
        })
        for (let index = 0; index < accountBlocks.length - 1; index++) {
            const batch = [accountBlocks[index] + 1, accountBlocks[index + 1]];
            let accountBatch = [];
            for (let i = batch[0]; i < batch[1]; i++) {
                accountBatch.push(this.generalLedgerLines[i])
            }
            this.accountBlocks.push(accountBatch)
        }
    }

    validate() {
        this._isValid = this.generalLedgerLines[7].split('\t').length === 11
    }

    get isValid() {
        return this._isValid;
    }

    get accountBlocks() {
        return this._accountBlocks
    }

    secondaryParse() {
        this.accountObjects = [];
        this._accountBlocks
            .filter((v, index) => index % 2 === 0) // All odd blocks are basically summaries of the previous block
            .forEach(lineArray => {
                const accountDetails = lineArray.length > 0 ? lineArray[0].split('\t') : ['', ''];
                if (accountDetails[0] === '') return;
                let accountObject = new AccountRecord(accountDetails[0], accountDetails[1])
                lineArray.forEach((line, index) => {
                    if (index === 0) return 0;
                    accountObject.addGeneralLedgerLine(new GeneralLedgerLine(line))
                })
                this.accountObjects.push(accountObject)
                console.log({ accountNumber: accountObject.accountNumber, accountDesc: accountObject.accountDescription, getMonthlyTotal: accountObject.getMonthlyTotal('01'), month: 'January' })
                console.log({ accountNumber: accountObject.accountNumber, accountDesc: accountObject.accountDescription, getMonthlyTotal: accountObject.getMonthlyTotal('02'), month: 'February' })
                console.log({ accountNumber: accountObject.accountNumber, accountDesc: accountObject.accountDescription, getMonthlyTotal: accountObject.getMonthlyTotal('03'), month: 'March' })
            })
    }

}

class ResultReport {
    constructor(file) {
        this.resultReport = file;
        this.parseFile();
        this.validate();
    }

    parseFile() {
        this.resultReportLines = this.resultReport.split('\n');
    }

    validate() {
        this._isValid = this.resultReportLines[7].split('\t').length === 11
    }

    get isValid() {
        return this._isValid;
    }
}

class GeneralLedgerLine {
    //["Konto", "Namn/Vernr", "Ks", "�", "Datum", "Text", "Transaktionsinfo", "Debet", "Kredit", "Saldo", ""]
    constructor(line) {
        this.line = line;
        this.parseLine();
    }

    parseLine() {
        this._parsedLine = this.line.split('\t');
    }

    get isDateLine() {
        return this._parsedLine[4].substr(0, 10).split('-').length === 3;
    }

    get month() {
        return this.isDateLine ? this._parsedLine[4].substr(0, 10).split('-')[1] : ''
    }

    get debit() {
        let debit = parseInt(this._parsedLine[7].replace(',', '.'))
        return isNaN(debit) ? 0 : debit;
    }

    get credit() {
        let credit = parseInt(this._parsedLine[8].replace(' ', '').replace(',', '.'));
        return isNaN(credit) ? 0 : credit;
    }
}

class AccountRecord {
    constructor(accountNumber, accountDescription) {
        this._accountNumber = accountNumber;
        this._accountDescription = accountDescription;
        this._generalLedgerLines = [];
    }

    addGeneralLedgerLine(line) {
        this._generalLedgerLines.push(line);
        //if (this._accountNumber === '3445') console.log(line.credit)
    }

    get isCreditAccount() {
        return ['3', '2'].indexOf(this._accountNumber.substr(0, 1)) > -1
    }

    get isDebitAccount() {
        return ['3', '2'].indexOf(this._accountNumber.substr(0, 1)) === -1
    }

    get accountNumber() {
        return this._accountNumber;
    }

    get accountDescription() {
        return this._accountDescription;
    }

    getMonthlyAmountCollection(month) {
        //if (this.accountNumber === '3410') console.log(this._generalLedgerLines)
        return this._generalLedgerLines
            .filter(gl => gl.month === month)
            .map(gl => this.isCreditAccount ? parseInt(gl.credit) - parseInt(gl.debit) : parseInt(gl.debit) - parseInt(gl.credit))
            .filter(v => !isNaN(v))
    }

    getMonthlyTotal(month) {
        //console.log(this.getMonthlyAmountCollection(month))
        return this.getMonthlyAmountCollection(month)
            .reduce((a, b) => a + b, 0)
    }
}

/**
 * 
 * Credit Account -> Credit - Debit
 * Debit Account -> Debit - Credit
 * 
 */