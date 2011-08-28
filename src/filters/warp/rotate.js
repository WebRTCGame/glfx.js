/**
 * @filter       Rotate
 * @description  Rotate image by a number of radians. Does not resize the texture.
 * @param angle  The angle in radians
 */
function rotate(angle) {
    return this.matrixWarp([
        Math.cos(angle), -Math.sin(angle), 0,
        Math.sin(angle), Math.cos(angle), 0,
        0, 0, 1
    ], false, true);
}
