const { google } = require('googleapis');
const fs = require('fs');
const csvParser = require('csv-parser');
const yaml = require('yaml');
const path = require('path');

// Konfigurationsdatei laden
const config = yaml.parse(fs.readFileSync('./conf/google-conf.yaml', 'utf-8'));

// Authentifikation
async function authenticate() {
    const creds = JSON.parse(fs.readFileSync('./conf/google-cred.json', 'utf-8'));
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: creds.client_email,
            private_key: creds.private_key,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return auth;
}

// CSV-Import
async function importCsvToSheet(csvFilePath) {
    const auth = await authenticate();
    const sheets = google.sheets({ version: 'v4', auth });

    const csvData = [];
    const sheetName = path.basename(csvFilePath, path.extname(csvFilePath));  // Verwende den Dateinamen als Sheet-Name
    let headers = [];

    // CSV-Datei lesen und in ein Array konvertieren
    fs.createReadStream(csvFilePath)
        .pipe(csvParser({ separator: ';' }))  // Passe Trennzeichen an
        .on('headers', (headerList) => {
            headers = headerList;  // Speichere die Header-Zeile
        })
        .on('data', (row) => {
            csvData.push(Object.values(row));  // CSV in Array von Werten umwandeln
        })
        .on('end', async () => {
            try {
                // Hole Spreadsheet-Informationen
                const spreadsheet = await sheets.spreadsheets.get({
                    spreadsheetId: config.payoutSheetId,
                });

                // Überprüfen, ob das Sheet bereits existiert
                const sheetExists = spreadsheet.data.sheets.some(
                    (sheet) => sheet.properties.title === sheetName
                );

                if (!sheetExists) {
                    // Neues Sheet erstellen, falls nicht vorhanden
                    await sheets.spreadsheets.batchUpdate({
                        spreadsheetId: config.payoutSheetId,
                        requestBody: {
                            requests: [
                                {
                                    addSheet: {
                                        properties: {
                                            title: sheetName,
                                        },
                                    },
                                },
                            ],
                        },
                    });
                    console.log(`New sheet '${sheetName}' created.`);
                } else {
                    console.log(`Sheet '${sheetName}' already exists.`);
                }

                // Füge zuerst die Header-Zeile ein
                await sheets.spreadsheets.values.update({
                    spreadsheetId: config.payoutSheetId,
                    range: `${sheetName}!A1`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [headers],
                    },
                });

                // Füge dann die CSV-Daten ein (unterhalb der Header-Zeile)
                await sheets.spreadsheets.values.update({
                    spreadsheetId: config.payoutSheetId,
                    range: `${sheetName}!A2`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: csvData,
                    },
                });
                console.log('CSV data successfully imported to the sheet.');
                //console.log(getSheetLink());
            } catch (error) {
                console.error('Error during CSV import:', error);
            }
        });
}

// Generate Google Sheets link
async function getSheetLink(spreadsheetId = config.payoutSheetId) {
    const auth = await authenticate();
    const drive = google.drive({ version: 'v3', auth });

    try {
        // Get file information from Google Drive
        const file = await drive.files.get({
            fileId: spreadsheetId,
            fields: 'webViewLink',
        });

        const link = file.data.webViewLink;
        console.log(`Google Sheets Link: ${link}`);
        return link;
    } catch (error) {
        console.error('Error retrieving Google Sheets link:', error);
    }
}

module.exports = { importCsvToSheet };
