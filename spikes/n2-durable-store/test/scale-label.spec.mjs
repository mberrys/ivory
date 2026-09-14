import assert from 'node:assert/strict';
import test from 'node:test';
import {
    SPARSE_ZERO_PLACEHOLDER,
    describeLargeBlob,
    isContentAddressedScaleProof,
    sha256OfZeros,
} from '../src/scale.mjs';

test('sha256OfZeros is a digest of zero bytes, not a CAS admission', () => {
    const digest = sha256OfZeros(16);
    assert.equal(digest, sha256OfZeros(16));
    assert.notEqual(digest, sha256OfZeros(32));
});

test('describeLargeBlob labels unlabeled 10 GiB historical fixtures as sparse zeros, not CAS', () => {
    const blob = describeLargeBlob({
        blobBytes: 10737418240,
        largeDigest: '732377e7f4a2abdc13ddfa1eb4c9c497fd2a2b294674d056cf51581b47dd586d',
    });
    assert.equal(blob.kind, SPARSE_ZERO_PLACEHOLDER);
    assert.equal(blob.casAdmissionPath, false);
    assert.equal(blob.contentAddressedScaleProof, false);
    assert.equal(blob.physicalBytesCopied, 0);
    assert.equal(blob.inferred, true);
    assert.equal(blob.digestSource, 'sha256-of-zeros-in-memory');
    assert.equal(isContentAddressedScaleProof({ blobBytes: 10737418240 }), false);
});

test('explicit sparse-zero placeholder cannot pass a CAS scale proof', () => {
    const scale = {
        blobBytes: 10737418240,
        largeBlob: {
            kind: SPARSE_ZERO_PLACEHOLDER,
            logicalByteSize: 10737418240,
            physicalBytesCopied: 0,
            casAdmissionPath: false,
            digestSource: 'sha256-of-zeros-in-memory',
        },
    };
    const blob = describeLargeBlob(scale);
    assert.equal(blob.contentAddressedScaleProof, false);
    assert.equal(isContentAddressedScaleProof(scale), false);
});

test('only a real CAS admission of copied bytes can pass the scale proof', () => {
    const scale = {
        blobBytes: 4096,
        largeBlob: {
            kind: 'cas-admitted-bytes',
            logicalByteSize: 4096,
            physicalBytesCopied: 4096,
            casAdmissionPath: true,
        },
    };
    assert.equal(describeLargeBlob(scale).contentAddressedScaleProof, true);
    assert.equal(isContentAddressedScaleProof(scale), true);
});
