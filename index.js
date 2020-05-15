const yargs = require('yargs');
const fs = require('fs').promises;
const puppeteer = require('puppeteer');
const { Octokit } = require("@octokit/rest");


async function readJsonFile(path) {
    const binaryData = await fs.readFile(path, "binary");
    return JSON.parse(binaryData);
}

async function savePageAsPdf(url, outputFilename, headers = undefined) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    if (headers) {
        page.setExtraHTTPHeaders(headers);
    }

    await page.goto(url);
    await page.pdf({path: outputFilename});

    await browser.close();
}

async function listRepos(personalAccessToken, owner) {
    const octokit = new Octokit({
        auth: personalAccessToken
    });

    const repos = await octokit.paginate(
        'GET /user/repos'
    );

    const filteredRepos = repos.filter(x => x.owner.login === owner);

    const repoNames = filteredRepos.map(x => x.name);
    return repoNames;
}

async function main() {    
    yargs
        .command({
            command: 'list-repos <personal-access-token> <owner>',
            desc: 'Lists repositories for given owner (organization)',
            handler: async (argv) => {
                const repoList = await listRepos(argv.personalAccessToken, argv.owner);
                console.log(repoList);
            }
        })
        .command({
            command: 'save-pdf [output] [headers-json-file] <url>',
            desc: 'Save a PDF file from a page',
            builder: (yargs) => yargs.default('output', 'output.pdf').default('headers-json-file', undefined),
            handler: async (argv) => {
                let headers = undefined;
                if (argv.headersJsonFile) {
                    headers = await readJsonFile(argv.headersJsonFile);
                }
                
                await savePageAsPdf(argv.url, argv.output, headers);
            }
        }) 
        .help()
        .alias('help', 'h')
        .argv;
};

main();