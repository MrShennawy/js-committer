/**
 * Works out a conventional commit scope from the changed paths.
 *
 * The scope is only offered when the whole change sits under one area, since
 * a scope that covers half the commit is worse than none at all.
 */

// Directories that group a project rather than name an area of it.
const CONTAINER_DIRS = new Set(['src', 'lib', 'app', 'packages', 'apps', 'modules', 'services', 'libs', 'components']);

// Files that belong to the repository as a whole, not to any one area.
const ROOT_FILES = /^(package(-lock)?\.json|readme|license|changelog|\.[^/]+|[^/]*\.(md|ya?ml|toml|lock))$/i;

const segmentsOf = (path) => path.split('/').filter(Boolean);

/**
 * The first segment that names an area rather than a container.
 * "packages/api/src/routes.js" -> "api", "src/auth/login.js" -> "auth"
 */
const areaOf = (path) => {
    const segments = segmentsOf(path);
    if (segments.length < 2) return null;

    for (let i = 0; i < segments.length - 1; i++) {
        const segment = segments[i];
        if (CONTAINER_DIRS.has(segment.toLowerCase())) continue;
        return segment;
    }

    // Everything before the file name was a container, so use the last of them.
    return segments[segments.length - 2] ?? null;
};

/**
 * @param {{status: string, path: string}[]} files
 * @param {{allowed?: string[]}} options - when given, the scope must be listed
 * @returns {string|null}
 */
export const detectScope = (files = [], {allowed = []} = {}) => {
    const paths = files
        .map(file => file.path)
        .filter(path => !ROOT_FILES.test(path));

    if (!paths.length) return null;

    const areas = new Set(paths.map(areaOf));
    if (areas.size !== 1) return null;

    const [scope] = [...areas];
    if (!scope) return null;

    // A restricted list means the project only accepts those names.
    if (allowed.length && !allowed.includes(scope)) return null;

    return scope;
};

export default detectScope;
