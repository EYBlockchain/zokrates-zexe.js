const childProcess = require('child_process');
const jsonfile = require('jsonfile');
const deleteFile = require('./utils/utils');

const { spawn } = childProcess;
const { writeFile } = jsonfile;

/**
 * Takes in a proof and a verification key and determines if the proof verifies.
 *
 * @example
 * generateProof('./code/ft-mint/ft-mint-pk.key',
 *   './code/ft-mint/ft-mint-compiled',
 *   'gm17',
 *   {
 *     createFile: true,
 *     directory: './code/ft-mint',
 *     fileName: 'ft-mint-proof.json',
 *   },
 * );
 *
 * @param {String} provingKeyPath - Path to proving key
 * @param {String} codePath - Path to code file (Result of compile that doesn't end in .code)
 * @param {String} provingScheme - Available options are 'g16', 'pghr13', 'gm17'
 * @param {String} backEnd - Available options are 'libsnark', 'bellman', 'ark'
 * @param {Object} [options] - Options for output
 * @param {Boolean} options.createFile - Whether or not to output a json file
 * @param {String} [options.directory=./] - Directory to output files in
 * @param {String} [options.fileName=proof.json] - Name of JSON proof file ()
 * @returns {Object} JSON of the proof.
 */
async function verify(vk, proof, provingScheme = 'gm17', backend = 'ark', curve = 'bn128') {
  // we've provided a json proof and a verifying key but Zokrates needs to read
  // these from a file. Thus we should write them to temporary unique files.
  // Note: Math.random is used to create unique filename to avoid error at concurrent execution.
  const proofTempFile = `/tmp/proof-${Math.random()}-${Math.random()}.json`;
  const vkTempFile = `/tmp/verify-${Math.random()}-${Math.random()}.key`;
  await Promise.all([writeFile(vkTempFile, vk), writeFile(proofTempFile, proof)]);

  const args = [
    'verify',
    '-v',
    vkTempFile,
    '-j',
    proofTempFile,
    '--proving-scheme',
    provingScheme,
    '--backend',
    backend,
    '--curve',
    curve,
  ];

  return new Promise((resolve, reject) => {
    const zokrates = spawn('/app/zokrates', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ZOKRATES_STDLIB: process.env.ZOKRATES_STDLIB,
      },
    });

    let output = '';
    zokrates.stdout.on('data', data => {
      output += data.toString('utf8');
    });

    zokrates.stderr.on('data', err => {
      reject(new Error(`Verify failed: ${err}`));
    });

    zokrates.on('close', () => {
      // we no longer need the temporary files
      deleteFile(proofTempFile);
      deleteFile(vkTempFile);
      // ZoKrates sometimes outputs error through stdout instead of stderr,
      // so we need to catch those errors manually.
      if (output.includes('panicked')) reject(new Error(output.slice(output.indexOf('panicked'))));

      if (output.includes('PASS')) resolve(true);
      else resolve(false);
    });
  });
}

module.exports = verify;
