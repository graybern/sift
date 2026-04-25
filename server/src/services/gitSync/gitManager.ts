import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs';
import path from 'path';

export interface CommitResult {
  hash: string;
  filesChanged: number;
}

export interface PullResult {
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export interface GitStatus {
  modified: number;
  created: number;
  deleted: number;
  isClean: boolean;
}

export class GitManager {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  async ensureRepo(repoUrl: string, branch: string, authToken: string): Promise<void> {
    const authedUrl = injectToken(repoUrl, authToken);
    const gitDir = path.join(this.repoPath, '.git');

    if (!fs.existsSync(gitDir)) {
      fs.mkdirSync(this.repoPath, { recursive: true });
      const parentGit = simpleGit(path.dirname(this.repoPath));
      await parentGit.clone(authedUrl, this.repoPath, ['--branch', branch]);
      this.git = simpleGit(this.repoPath);
      await this.configureUser();
    } else {
      this.git = simpleGit(this.repoPath);
      const remotes = await this.git.getRemotes(true);
      const origin = remotes.find(r => r.name === 'origin');
      if (origin) {
        const currentUrl = origin.refs.fetch;
        if (stripToken(currentUrl) !== stripToken(authedUrl)) {
          await this.git.remote(['set-url', 'origin', authedUrl]);
        } else if (!currentUrl.includes('@') && authToken) {
          await this.git.remote(['set-url', 'origin', authedUrl]);
        }
      }
      await this.configureUser();
    }
  }

  private async configureUser(): Promise<void> {
    await this.git.addConfig('user.name', 'Sift Sync');
    await this.git.addConfig('user.email', 'sift@localhost');
  }

  async pull(branch: string): Promise<PullResult> {
    const result = await this.git.pull('origin', branch);
    return {
      filesChanged: result.files.length,
      insertions: typeof result.insertions === 'number' ? result.insertions : Object.keys(result.insertions).length,
      deletions: typeof result.deletions === 'number' ? result.deletions : Object.keys(result.deletions).length,
    };
  }

  async commitAndPush(message: string, branch: string): Promise<CommitResult | null> {
    await this.git.add('-A');
    const status = await this.git.status();

    if (status.isClean()) {
      return null;
    }

    const commitResult = await this.git.commit(message);
    await this.git.push('origin', branch);

    return {
      hash: commitResult.commit,
      filesChanged: status.files.length,
    };
  }

  async status(): Promise<GitStatus> {
    const s = await this.git.status();
    return {
      modified: s.modified.length,
      created: s.created.length + s.not_added.length,
      deleted: s.deleted.length,
      isClean: s.isClean(),
    };
  }

  async getLastCommitInfo(): Promise<{ hash: string; date: string; message: string } | null> {
    try {
      const log = await this.git.log({ maxCount: 1 });
      if (!log.latest) return null;
      return {
        hash: log.latest.hash,
        date: log.latest.date,
        message: log.latest.message,
      };
    } catch {
      return null;
    }
  }

  async testConnection(repoUrl: string, authToken: string): Promise<{ success: boolean; message: string }> {
    const authedUrl = injectToken(repoUrl, authToken);
    try {
      const tempGit = simpleGit();
      await tempGit.listRemote([authedUrl]);
      return { success: true, message: 'Connection successful' };
    } catch (err: any) {
      const message = err.message?.includes('Authentication')
        ? 'Authentication failed. Check your Personal Access Token.'
        : `Connection failed: ${err.message}`;
      return { success: false, message };
    }
  }
}

function injectToken(url: string, token: string): string {
  if (!token) return url;
  try {
    const parsed = new URL(url);
    parsed.username = token;
    parsed.password = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function stripToken(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    return url;
  }
}
