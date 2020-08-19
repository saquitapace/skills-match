# Skill Match

### Prerequisites

MongoDB, Node v10.16.3, npm v6.9.0

### Install Dependencies

Install dependencies in both Root and Client folders
```
npm i
cd client
npm i
```

### Run the App with Dev Environment

On root directory, run
```
npm run dev
```

### Troubleshooting

If you see an error that complains about some processes being in use, kill these processes and retry.
To see listening processes:
```
sudo lsof -i -P -n | grep LISTEN
```
To kill process:
```
kill <pid>
```

### Git Workflow

#### Initial Setup

Please be advised that using Github Desktop or any other git clients are not recommended.

1. Setup SSH keys, and only use ssh when pushing and cloning. Please refer to https://help.github.com/en/enterprise/2.15/user/articles/adding-a-new-ssh-key-to-your-github-account
2. Fork the DEV branch of this repo, and work off of your forked DEV branch.
3. Add master of this repo as a remote named `upstream` for your fork. Please refer to https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/configuring-a-remote-for-a-fork

#### Opening PRs

1. Before opening a PR, please make sure you have the latest changes by running `git fetch upstream` and `git rebase upstream/DEV` on your forked DEV branch.
2. If you have conflicts, then resolve conflicts on your editor, add your resolved changes to stage and continue rebase.
3. Run `git push -f` to force push the latest changes to your remote fork.
4. On Github website, click "create a new pull request", review your changes, and open that PR for other Devs to review and approve.
5. Once approved, feel free to merge to our DEV.

#### Addressing comments on PR

If you recieve feedback from other devs on your pr, fix thoses changes, run `git commit --amend`, and `git push -f`. This will update your PR with your changes automatically.

### General SkillMatch Codebase Overview

#### Tech Stack

Currently, SkillMatch mainly uses React, Redux, Redux-Saga, Node Express and MongoDB. If you are not familiar any one of these, please read official documentation beforehand.

### IBM Cloud Deployment

CI Pipeline is located at: https://cloud.ibm.com/devops/pipelines/2722a9d8-fe68-4816-90e3-9bb22e3e90d8?env_id=ibm:yp:us-south

To deploy `master` branch to PROD, press the run button on the `Build Prod` stage.

`Build Dev` followed by `Deploy Dev` will automatically run when the `DEV` branch is pushed to.

To merge DEV to master, create a new branch off of DEV (name it DevToProdYYYY/MM/DD) and run `git checkout master manifest.yml server/settings.js server/config/mongoDB/production.json` to add specific Prod configs to the branch, commit and push those changes to your branch, and then merge that branch into master.

**Note**: webpack needs at least 2.5 GB of memory on the build machine, specified in `manifest.yml`, for both Dev and Prod configs to have a stable deployment.

### Excel File Uploading for Admins

* see `server/routes/api/Excel.js`

When uploading an excel file under `Setup` on the app, there are some column headers that are required for the upload to succeed, e.g. CNUM. If an upload fails there will be an Error message presented on the UI explaining what headers are missing from the file.

In addition, `job role specialty` and `service- service area` may be one column or split into 2 columns in the Excel file, the code will check for the separated columns if it cannot find a single column. If 2 separate columns exist, the code will concatenate them into 1 field separated by a `-` e.g. `{job role}-{specialty}`.

### ESLint

ESLint is enabled for the project on a file-by-file basis, and has been configured to work with Create React App using babel-eslint parser. To add your file to the ESLint flow, append to `.eslintignore` with your file path preceded by a `!`, e.g. `!somefilepath/somefile.js`. (This is because by default all files are ignored by eslint, and you negate the ignore on specific files)
