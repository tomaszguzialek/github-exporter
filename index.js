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

async function listPullRequests(personalAccessToken, owner, repo, assignee) {
    const octokit = new Octokit({
        auth: personalAccessToken
    });

    const pulls = await octokit.paginate(
        'GET /repos/:owner/:repo/pulls?state=all',
        {
            owner: owner,
            repo: repo
        }
    );

    var filteredPulls = pulls;
    if (assignee) {
        filteredPulls = pulls.filter(x => x.assignee && x.assignee.login === assignee);
    }
    

    return filteredPulls.map(x => x.html_url);
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
            command: 'list-prs <personal-access-token> <owner> <assignee>',
            desc: 'Lists pull requests for repositories owned by given owner (organization) and assigned to given assignee',
            handler: async (argv) => {
                const repoList = await listRepos(argv.personalAccessToken, argv.owner);
                console.log("Fetched " + repoList.length + " repositories...");

                for (let i = 0; i < repoList.length; i++) {
                    const repo = repoList[i];
                    console.log("Processing repository " + repo + " (" + i + "/" + repoList.length + ")...");
                    const pulls = await listPullRequests(argv.personalAccessToken, argv.owner, repo, argv.assignee);
                    console.log(pulls);
                }
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