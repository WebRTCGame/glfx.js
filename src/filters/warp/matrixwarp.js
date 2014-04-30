/**
 * @filter                Matrix Warp
 * @description           Transforms an image by a 2x2 or 3x3 matrix. The coordinates used in
 *                        the transformation are (x, y) for a 2x2 matrix or (x, y, 1) for a
 *                        3x3 matrix, where x and y are in units of pixels.
 * @param matrix          A 2x2 or 3x3 matrix represented as either a list or a list of lists.
 *                        For example, the 3x3 matrix [[2,0,0],[0,3,0],[0,0,1]] can also be
 *                        represented as [2,0,0,0,3,0,0,0,1] or just [2,0,0,3].
 * @param inverse         A boolean value that, when true, applies the inverse transformation
 *                        instead. (optional, defaults to false)
 * @param center          A boolean value that, when true, shifts the texture to be centered
 *                        over the origin (0,0) where x ranges from -width/2 to width/2 and y
 *                        ranges from -height/2 to height/2, which is easier
 *                        to use for simple operations like flipping and rotating.
 */
function matrixWarp(matrix, inverse, center) {
    gl.matrixWarp = gl.matrixWarp || warpShader('\
        uniform mat3 matrix;\
        uniform bool center;\
    ', '\
        if (center) coord -= texSize / 2.0;\
        vec3 warp = matrix * vec3(coord, 1.0);\
        coord = warp.xy / warp.z;\
        if (center) coord += texSize / 2.0;\
    ');

    // Flatten all members of matrix into one big list
    matrix = Array.prototype.concat.apply([], matrix);

    // Extract a 3x3 matrix out of the arguments
    if (matrix.length == 4) {
        matrix = [
            matrix[0], matrix[1], 0,
            matrix[2], matrix[3], 0,
            0, 0, 1
        ];
    } else if (matrix.length != 9) {
        throw 'can only warp with 2x2 or 3x3 matrix';
    }

    simpleShader.call(this, gl.matrixWarp, {
        matrix: inverse ? getInverse(matrix) : matrix,
        texSize: [this._.texture.width, this._.texture.height],
        center: center | 0
    });

    return this;
}
