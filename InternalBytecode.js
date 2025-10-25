/**
 * InternalBytecode.js
 * Utility helpers mirroring React Native's expected symbolication shim.
 * Ensures Metro can locate the file during stack symbolication.
 */

const { Buffer } = require('buffer');

class InternalBytecode {
  /**
   * Encodes an array of instruction codes into a byte buffer.
   * @param {number[]} instructions
   * @returns {Buffer}
   */
  static encode(instructions) {
    return Buffer.from(instructions);
  }

  /**
   * Decodes a byte buffer back into an array of instruction codes.
   * @param {Buffer} buffer
   * @returns {number[]}
   */
  static decode(buffer) {
    return Array.from(buffer);
  }

  /**
   * Validates the byte buffer shape (all bytes fall within the 0-255 range).
   * @param {Buffer} buffer
   * @returns {boolean}
   */
  static isValid(buffer) {
    return buffer.every((byte) => byte >= 0 && byte <= 255);
  }
}

module.exports = InternalBytecode;
