const yargs = require('yargs');
const fs = require('fs').promises;
const puppeteer = require('puppeteer');
const { Octokit } = require("@octokit/rest");
const moment = require('moment');


async function readJsonFile(path) {
    const binaryData = await fs.readFile(path, "binary");
    return JSON.parse(binaryData);
}

async function savePageScreenshot(url, outputFilename, headers = undefined) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.setViewport({
        width: 1920,
        height: 1080
    });
    
    if (headers) {
        page.setExtraHTTPHeaders(headers);
    }

    await page.goto(url);
    await page.screenshot({
        path: outputFilename,
        fullPage: true
    });

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

async function listPullRequests(personalAccessToken, owner, repo, assignee, month) {
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

    if (month) {
        const startOfTheMonth = moment(month, "YYYY-MM");
        const endOfTheMonth = moment(month, "YYYY-MM").add(1, 'month');
        filteredPulls = filteredPulls.filter(x => {
            const createdAt = moment(x.created_at);
            return createdAt >= startOfTheMonth && createdAt < endOfTheMonth;
        });
    }
    

    return filteredPulls;
}

function asyncSleep(timeInMs) {
    return new Promise(resolve => setTimeout(resolve, timeInMs));
}

async function retry(funcParam, attempts = 5) {
    let attempt = 1;
    
    while (true) {
        try {
            return await funcParam();
        } catch (ex) {
            if (attempt <= attempts) {
                const sleepTimeInSeconds = Math.pow(2, attempt) * attempt;
                console.log("Retrying " + funcParam + " after sleeping " + sleepTimeInSeconds + "s...");
                await asyncSleep(sleepTimeInSeconds * 1000);
                attempt++;
            } else {
                console.error("Gave up on " + funcParam + "...");
                throw ex;
            }
        }
    } 
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
            command: 'list-prs <personal-access-token> <owner> <assignee> <month>',
            desc: 'Lists pull requests for repositories owned by given owner (organization) and assigned to given assignee, created in given month',
            handler: async (argv) => {
                const repoList = await listRepos(argv.personalAccessToken, argv.owner);
                console.log("Fetched " + repoList.length + " repositories...");

                for (let i = 0; i < repoList.length; i++) {
                    const repo = repoList[i];
                    console.log("Processing repository " + repo + " (" + i + "/" + repoList.length + ")...");
                    const pulls = await listPullRequests(argv.personalAccessToken, argv.owner, repo, argv.assignee, argv.month);
                    console.log(pulls.map(p => p.html_url));
                }
            }
        })
        .command({
            command: 'export-prs <personal-access-token> [headers-json-file] <owner> <assignee> <month>',
            desc: 'Exports pull requests for repositories owned by given owner (organization) and assigned to given assignee, created in given month',
            builder: (yargs) => yargs.default('headers-json-file', undefined),
            handler: async (argv) => {
                let headers = undefined;
                if (argv.headersJsonFile) {
                    headers = await readJsonFile(argv.headersJsonFile);
                }

                const repoList = await listRepos(argv.personalAccessToken, argv.owner);
                console.log("Fetched " + repoList.length + " repositories...");

                for (let i = 0; i < repoList.length; i++) {
                    const repo = repoList[i];
                    console.log("Processing repository " + repo + " (" + i + "/" + repoList.length + ")...");

                    await retry(async () => {
                        const pulls = await retry(async () => {
                            return await listPullRequests(argv.personalAccessToken, argv.owner, repo, argv.assignee, argv.month);
                        });
                    
                        for (let pullRequest of pulls) {
                            const diffUrl = pullRequest.html_url + "/files";
                            console.log("\tScreenshotting " + diffUrl);
                            
                            await retry(async () => {
                                await savePageScreenshot(diffUrl, pullRequest.base.repo.name + '#' + pullRequest.number + ".png", headers);
                            });
                        }
                    });
                }
            }
        })
        .command({
            command: 'save-screenshot [output] [headers-json-file] <url>',
            desc: 'Save a PDF file from a page',
            builder: (yargs) => yargs.default('output', 'output.png').default('headers-json-file', undefined),
            handler: async (argv) => {
                let headers = undefined;
                if (argv.headersJsonFile) {
                    headers = await readJsonFile(argv.headersJsonFile);
                }
                
                await savePageScreenshot(argv.url, argv.output, headers);
            }
        }) 
        .help()
        .alias('help', 'h')
        .argv;
};

main();