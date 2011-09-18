/**
 * @filter           Split Tone
 * @description      Add split toning to the image after converting to grayscale
 * @param highlights RGBA array to colorize highlights, with values from 0 to 1
 * @param shadows    RGBA array to colorize shadows, with values from 0 to 1
 * @param mix        Amount to mix split toned image with original, 0 to 1
 */
function splitTone(highlight, shadows, mix) {
    gl.splitTone = gl.splitTone || new Shader(null, '\
        uniform sampler2D texture;\
        uniform vec4 color1;\
        uniform vec4 color2;\
        uniform float mix;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            \
            float avg = (color.r + color.g + color.b) / 3.0;\
            vec4 toned = (color1 * avg) + (color2 * (1.0 - avg));\
            \
            float rdiff = toned.r - avg;\
            float gdiff = toned.g - avg;\
            float bdiff = toned.b - avg;\
            \
            gl_FragColor = (vec4(avg + rdiff - (gdiff / 2.0) - (bdiff / 2.0), avg + gdiff - (rdiff / 2.0) - (bdiff / 2.0), avg + bdiff - (rdiff / 2.0) - (gdiff / 2.0), 1.0) * mix) + (color * (1.0 - mix));\
        }\
    ');
    
    simpleShader.call(this, gl.splitTone, {
        color1: highlight || [0.4, 0.15, 0.0, 1.0],
        color2: shadows || [0.04, 0.16, 0.28, 1.0],
        mix: clamp(0, mix, 1) || 1.0
    });

    return this;
}
