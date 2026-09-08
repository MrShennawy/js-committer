import {readSettings, writeSettings} from './handler.js';
import {repoRoot} from '../support/config.js';

/**
 * Per-project memory that belongs to the person, not the repository.
 *
 * Anything a team should share goes in .committerrc; this is for choices one
 * user made in one clone, such as the build command they actually run.
 */
const STORE = 'projects';

const key = () => repoRoot();

export const readProject = () => {
    const all = readSettings(STORE);
    return all[key()] ?? {};
}

export const updateProject = (changes) => {
    const all = readSettings(STORE);
    const current = all[key()] ?? {};

    writeSettings(STORE, {...all, [key()]: {...current, ...changes}});
}

export default {readProject, updateProject};
