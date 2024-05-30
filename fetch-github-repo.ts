import { Octokit } from "@octokit/rest";
import * as fs from 'fs-extra';
import * as path from 'path';
import * as shell from 'shelljs';

async function fetchGitHubRepo() {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const owner = 'JiaHongL';
  const repo = 'ng-chat-app';

  try {
    const { data } = await octokit.repos.get({ owner, repo });
    const repoUrl = data.clone_url;

    const repoDir = path.join(__dirname, 'temp-repo');
    if (fs.existsSync(repoDir)) {
      shell.rm('-rf', repoDir);
    }

    shell.exec(`git clone ${repoUrl} ${repoDir}`);

    const angularProjectDir = path.join(repoDir, '');
    if (!fs.existsSync(path.join(angularProjectDir, 'angular.json'))) {
      throw new Error('Angular project not found in the specified directory');
    }

    shell.cd(angularProjectDir);
    shell.exec('npm install');
    shell.exec('npx ng build --configuration production');

    const distDir = path.join(angularProjectDir, 'dist/ng-chat-app/browser');
    const publicDir = path.join(__dirname, 'public');
    if (!fs.existsSync(distDir)) {
      throw new Error('Build output directory not found');
    }
    fs.copySync(distDir, publicDir, { overwrite: true });

    console.log(`Build output copied to ${publicDir}`);
  } catch (error) {
    console.error('Error fetching the GitHub repo:', error);
  }
}

// 確保腳本能獨立運行
if (require.main === module) {
  fetchGitHubRepo();
}

export { fetchGitHubRepo };
