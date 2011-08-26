/**
 * @filter           Flip
 * @description      Flip an image vertically and/or horizontally
 * @param vertical   If true, flip vertically
 * @param horizontal If true, flip horizontally
 */
function flip(vertical, horizontal) {
    gl.flip = gl.flip || new Shader(null, '\
        uniform sampler2D texture;\
        uniform bool vertical;\
        uniform bool horizontal;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, vec2((horizontal) ? (1.0 - texCoord.x) : texCoord.x, (vertical) ? (1.0 - texCoord.y) : texCoord.y));\
            \
            gl_FragColor = color;\
        }\
    ');

    simpleShader.call(this, gl.flip, {
        vertical: vertical ? 1 : 0,
        horizontal: horizontal ? 1 : 0
    });

    return this;
}
