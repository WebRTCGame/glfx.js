/**
 * @filter           Crop
 * @description      Crop the texture. This should be used along with passing the new
 *                   width/height to the canvas.draw() method because the image will
 *                   just be stretched without it.
 * @param left       Number of pixels to crop from the left side
 * @param top        Number of pixels to crop from the top side
 * @param right      Number of pixels to crop from the right side
 * @param bottom     Number of pixels to crop from the bottom side
 */
function crop(left, top, right, bottom) {
    gl.crop = gl.crop || new Shader(null, '\
        uniform sampler2D texture;\
        uniform float left;\
        uniform float top;\
        uniform float right;\
        uniform float bottom;\
        varying vec2 texCoord;\
        void main() {\
            vec2 coord;\
            \
            coord.x = left + (texCoord.x * (1.0 - left - right));\
            coord.y = top + (texCoord.y * (1.0 - top - bottom));\
            \
            gl_FragColor = texture2D(texture, coord);\
        }\
    ');

    var w = this.width + left + right;
    var h = this.height + top + bottom;
    simpleShader.call(this, gl.crop, {
        left: left / w || 0,
        top: top / h || 0,
        right: right / w || 0,
        bottom: bottom / h || 0,
    });

    return this;
}
