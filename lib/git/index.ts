import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { exists } from '../fs/index';

const execAsync = promisify(exec);

// ============================================
// Git Operations Types
// ============================================

export interface Commit {
  hash: string;
  message: string;
  date: string;
  author: string;
}

// ============================================
// Git Operations
// ============================================

/**
 * Initialize a git repository with 'main' branch
 * @param projectPath - Path to the project directory
 * @throws Error if git is not installed or initialization fails
 */
export async function initRepo(projectPath: string): Promise<void> {
  try {
    // Initialize repo
    await execAsync('git init', { cwd: projectPath });
    
    // Configure git user for commits (required for git operations)
    await execAsync('git config user.email "canvas@pmwork.local"', { cwd: projectPath });
    await execAsync('git config user.name "Canvas"', { cwd: projectPath });
    
    // Create initial commit to establish main branch
    // Create a .gitkeep file to have something to commit
    const gitkeepPath = path.join(projectPath, '.gitkeep');
    await execAsync(`touch "${gitkeepPath}"`, { cwd: projectPath });
    await execAsync('git add .gitkeep', { cwd: projectPath });
    await execAsync('git commit -m "Initial commit"', { cwd: projectPath });
    
    // Rename branch to main if it's not already
    try {
      await execAsync('git branch -M main', { cwd: projectPath });
    } catch {
      // Branch might already be main, ignore error
    }
  } catch (error) {
    const err = error as Error;
    throw new Error(`Failed to initialize git repository: ${err.message}`);
  }
}

/**
 * Check if a directory is a git repository
 * @param projectPath - Path to check
 * @returns true if directory is a git repo, false otherwise
 */
export async function isGitRepo(projectPath: string): Promise<boolean> {
  try {
    const gitDir = path.join(projectPath, '.git');
    return await exists(gitDir);
  } catch {
    return false;
  }
}

/**
 * Stage all changes and create a commit
 * @param projectPath - Path to the git repository
 * @param message - Commit message
 * @throws Error if not a git repo or commit fails
 */
export async function commit(projectPath: string, message: string): Promise<void> {
  try {
    // Check if it's a git repo
    if (!(await isGitRepo(projectPath))) {
      throw new Error('Not a git repository');
    }

    // Stage all changes
    await execAsync('git add -A', { cwd: projectPath });

    // Check if there are changes to commit
    const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: projectPath });
    
    if (!statusOutput.trim()) {
      // No changes to commit
      return;
    }

    // Create commit
    await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: projectPath });
  } catch (error) {
    const err = error as Error;
    // Ignore "nothing to commit" errors
    if (err.message.includes('nothing to commit')) {
      return;
    }
    throw new Error(`Failed to commit: ${err.message}`);
  }
}

/**
 * Get commit history
 * @param projectPath - Path to the git repository
 * @param limit - Maximum number of commits to retrieve (default: 50)
 * @returns Array of commits
 * @throws Error if not a git repo or log retrieval fails
 */
export async function log(projectPath: string, limit: number = 50): Promise<Commit[]> {
  try {
    // Check if it's a git repo
    if (!(await isGitRepo(projectPath))) {
      throw new Error('Not a git repository');
    }

    // Get commit log with custom format
    // Format: hash|message|date|author
    const { stdout } = await execAsync(
      `git log -${limit} --pretty=format:"%H|%s|%aI|%an"`,
      { cwd: projectPath }
    );

    if (!stdout.trim()) {
      return [];
    }

    // Parse output
    const commits: Commit[] = stdout
      .trim()
      .split('\n')
      .map((line) => {
        const [hash, message, date, author] = line.split('|');
        return {
          hash: hash || '',
          message: message || '',
          date: date || '',
          author: author || '',
        };
      })
      .filter((commit) => commit.hash); // Filter out empty lines

    return commits;
  } catch (error) {
    const err = error as Error;
    throw new Error(`Failed to retrieve commit log: ${err.message}`);
  }
}

/**
 * Checkout a specific file from a commit
 * @param projectPath - Path to the git repository
 * @param filePath - Relative path to the file within the repo
 * @param commitHash - Commit hash to checkout from
 * @throws Error if not a git repo, file not found, or checkout fails
 */
export async function checkout(
  projectPath: string,
  filePath: string,
  commitHash: string
): Promise<void> {
  try {
    // Check if it's a git repo
    if (!(await isGitRepo(projectPath))) {
      throw new Error('Not a git repository');
    }

    // Validate commit hash format (basic check)
    if (!commitHash) {
      throw new Error('Invalid commit ref');
    }

    // Validate file path (prevent directory traversal)
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
      throw new Error('Invalid file path');
    }

    // Checkout file from commit
    await execAsync(`git checkout "${commitHash}" -- "${normalizedPath}"`, {
      cwd: projectPath,
    });
  } catch (error) {
    const err = error as Error;
    throw new Error(`Failed to checkout file: ${err.message}`);
  }
}

// ============================================
// Exports
// ============================================

export default {
  initRepo,
  isGitRepo,
  commit,
  log,
  checkout,
};
