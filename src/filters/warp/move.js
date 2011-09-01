/**
 * @filter           Move
 * @description      Translate an image horizontally and vertically
 * @param vertical   Number of pixels to move up or down
 * @param horizontal Number of pixels to move left or right
 */
function move(vertical, horizontal) {
    gl.move = gl.move || new Shader(null, '\
        uniform sampler2D texture;\
        uniform float vertical;\
        uniform float horizontal;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, vec2(texCoord.x + horizontal, texCoord.y + vertical));\
            \
            gl_FragColor = color;\
        }\
    ');

    simpleShader.call(this, gl.move, {
        vertical: clamp(-1.0, vertical / this._.texture.height, 1.0),
        horizontal: clamp(-1.0, horizontal / this._.texture.width, 1.0)
    });

    return this;
}
