//node main.js --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results --excel=Worldcup.csv --dataFolder=data
// https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results
// modules require :-
// npm init -y
// npm install minimist
// npm install axios
// npm install jsdom
// npm install excel4node
// npm install pdf-lib
let minimist = require("minimist");
let jsdom = require("jsdom");
let excel = require("excel4node");
let pdf = require("pdf-lib");
let fs = require("fs")
let path = require("path")
var urllib = require('urllib');


let args = minimist(process.argv);
console.log(args.source);
console.log(args.excel);
console.log(args.dataFolder);
main();
async function main() {
    // array of matches
    let rawMatches;
    if (fs.existsSync("matches.json") == 1) {
        console.log("yes matches exist");
        //if matches.json is already in folder then read it
        let matchesKaJSON = fs.readFileSync("matches.json", "utf-8");
        rawMatches = JSON.parse(matchesKaJSON);
    } else {
        //else create it
        console.log("no matches exist");
        rawMatches = await scrapDataFromWebsite(args.source);
        let matchesKaJSON = JSON.stringify(rawMatches);
        // console.log(rawMatches);
        fs.writeFileSync("matches.json", matchesKaJSON, "utf-8");
    }

    // create matches array
    let teams;
    if (fs.existsSync("teams.json") == 1) {
        //if teams exist in folder then read it
        console.log("yes teams exist");
        let teamsKaJSON = fs.readFileSync("teams.json", "utf-8");
        teams = JSON.parse(teamsKaJSON);
    } else {
        //if its not in folder then create team array and save it json
        teams = createTeamsFromArr(rawMatches);
        let teamKaJSON = JSON.stringify(teams);
        fs.writeFileSync("teams.json", teamKaJSON, "utf-8");
    }
    if (fs.existsSync("Worldcup.csv") == 0) {
        createExcel(teams, args.dataFolder);
    }
    createFoldersAndPDFs(teams, args.dataFolder);
}

async function scrapDataFromWebsite(url) {
    let response = await urllib.request(url);
    // console.log('status: %s, body size: %d, headers: %j', response.res.statusCode, response.data.length, response.res.headers);
    let html = response.res.data;
    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;
    // let scoreBlock = document.querySelectorAll("div .match-info.match-info-FIXTURES");
    let scoreBlock = document.querySelectorAll(".match-info.match-info-FIXTURES");
    let matches = [];

    //creating arr of object which will hold all matches info
    for (let i = 0; i < scoreBlock.length; i++) {
        let match = {
            t1: "",
            t2: "",
            t1Score: "",
            t2Score: "",
            result: ""
        };
        let matchParser = scoreBlock[i].querySelectorAll("div.name-detail > p.name");
        match.t1 = matchParser[0].textContent;
        match.t2 = matchParser[1].textContent;
        let scoreParser = scoreBlock[i].querySelectorAll("div.score-detail > span.score");
        if (scoreParser.length == 2) {
            match.t1Score = scoreParser[0].textContent;
            match.t2Score = scoreParser[1].textContent;

        } else if (scoreParser.length == 1) {
            match.t1Score = scoreParser[0].textContent;
        }

        match.result = scoreBlock[i].querySelector("div.status-text > span").textContent;
        // console.log(match);
        matches.push(match);

    }
    return matches;
}

function createTeamsFromArr(matches) {
    //now create and array of object individual teams this will going to have team_name and total matches played against different team
    //[ {"team": "india",
    // "matches":{
    //     vs:       obj inside obj

    // }}
    let teams = [];
    for (let i = 0; i < matches.length; i++) {
        insertIntoArray(teams, matches[i].t1);
        insertIntoArray(teams, matches[i].t2);
    }
    // console.log(teams.length);
    //now for each team inserting all played matches in matches array
    for (let i = 0; i < matches.length; i++) {
        insert_matches_in_teamsArr(teams, matches[i]);
    }

    return teams;
}


//function will create one single excel file which contain team wise sheets and self score, opp score, result
function createExcel(teams, dataFolder) {
    // Create a new instance of a Workbook class
    let workbook = new excel.Workbook();

    let myStyle = workbook.createStyle({
        font: {
            bold: true,
        },
        alignment: {
            horizontal: 'center',
        },

    });
    //traverse through teams
    for (let i = 0; i < teams.length; i++) {
        // Add Worksheets to the workbook
        let worksheet = workbook.addWorksheet(teams[i].name);
        worksheet.cell(1, 1).string("VS").style(myStyle);
        worksheet.cell(1, 2).string("Opponent-Score").style(myStyle);
        worksheet.cell(1, 3).string("Self-Score").style(myStyle);
        worksheet.cell(1, 4, 1, 9, true).string("Result").style(myStyle);

        //traverse through matches 
        for (let j = 0; j < teams[i].matches.length; j++) {
            // console.log(teams[i].matches[j].vs);
            // console.log(teams[i].matches[j].opponentScore);
            // console.log(teams[i].matches[j].selfScore);
            // console.log(teams[i].matches[j].result);
            worksheet.cell(j + 2, 1).string(teams[i].matches[j].vs);
            worksheet.cell(j + 2, 2).string(teams[i].matches[j].opponentScore);
            worksheet.cell(j + 2, 3).string(teams[i].matches[j].selfScore);
            worksheet.cell(j + 2, 4, j + 2, 9, true).string(teams[i].matches[j].result);
        }
    }
    workbook.write('Worldcup.csv');
}
function createFoldersAndPDFs(teams, dataFolder) {
    //make datafolder 
    if (fs.existsSync(dataFolder) == 1) {
        return;
    }
    fs.mkdirSync(dataFolder);
    for (let i = 0; i < teams.length; i++) {
        let folderName = path.join(dataFolder, teams[i].name);
        fs.mkdirSync(folderName);
        //traverse through matches 
        for (let j = 0; j < teams[i].matches.length; j++) {
            let matchFileName = path.join(folderName, teams[i].matches[j].vs + ".pdf")
            //send own team name, matches[j] json and file name
            createPDF(teams[i].name, teams[i].matches[j], matchFileName);
        }
    }
}

async function createPDF(teamName, matchesJSO, matchFileName) {
    let templateBytes = fs.readFileSync("template.pdf");
    let pdfDoc = await pdf.PDFDocument.load(templateBytes);
    let page = pdfDoc.getPage(0);
    let { width, height } = page.getSize()
    page.drawText(teamName, {
        x: width / 2 + 20,
        y: height - 106,
        size: 14
    });
    page.drawText(matchesJSO.vs, {
        x: width / 2 + 20,
        y: height - 136,
        size: 14
    });
    page.drawText(matchesJSO.selfScore, {
        x: width / 2 + 20,
        y: height - 167,
        size: 14
    });
    page.drawText(matchesJSO.opponentScore, {
        x: width / 2 + 20,
        y: height - 199,
        size: 14
    });
    page.drawText(matchesJSO.result, {
        x: width / 2 + 10,
        y: height - 230,
        size: 10.2
    });

    let pdfBytes = await pdfDoc.save();
    fs.writeFileSync(matchFileName, pdfBytes);
};

//helper functions to convert raw matches to main team array

function insert_matches_in_teamsArr(teams, teamsOBJ) {
    //find index to be inserted
    let id1 = findIndex(teams, teamsOBJ.t1);
    let id2 = findIndex(teams, teamsOBJ.t2);
    teams[id1].matches.push({
        vs: teamsOBJ.t2,
        selfScore: teamsOBJ.t1Score,
        opponentScore: teamsOBJ.t2Score,
        result: teamsOBJ.result
    });
    teams[id2].matches.push({
        vs: teamsOBJ.t1,
        selfScore: teamsOBJ.t2Score,
        opponentScore: teamsOBJ.t1Score,
        result: teamsOBJ.result
    });
}
function insertIntoArray(teams, team_name) {
    // console.log(teams.length);
    let idx = findIndex(teams, team_name);
    if (idx != -1) {
        return;
    }
    teams.push({
        name: team_name,
        matches: [] //creating an empty array to save all matches later
    });
}
function findIndex(teams, teamName) {
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == teamName) {
            return i;
        }
    }
    return -1;
}