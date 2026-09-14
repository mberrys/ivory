export class WriterContentionError extends Error {
    constructor(ownerPid) {
        super(`Project already has a live writer (pid ${ownerPid}).`);
        this.name = 'WriterContentionError';
        this.ownerPid = ownerPid;
    }
}

export class HeadConflictError extends Error {
    constructor(objectId, expected, actual) {
        super(`Expected head for ${objectId} was ${expected ?? '<none>'}, found ${actual ?? '<none>'}.`);
        this.name = 'HeadConflictError';
        this.objectId = objectId;
        this.expected = expected;
        this.actual = actual;
    }
}

export class BlobIntegrityError extends Error {
    constructor(digest, reason) {
        super(`Blob ${digest} is not installed or does not match its digest (${reason}).`);
        this.name = 'BlobIntegrityError';
        this.digest = digest;
        this.reason = reason;
    }
}

export class DiskFullError extends Error {
    constructor(where) {
        super(`Simulated ENOSPC during ${where}.`);
        this.name = 'DiskFullError';
        this.code = 'ENOSPC';
        this.where = where;
    }
}
