/**
 * @filter         Grid
 * @description    Draws a grid of a given color over the image.
 * @param distance X and Y distance between lines, e.g. [10, 25]. Defaults to the rule of
 *                 thirds grid.
 * @param color    RGBA color to draw as an array, e.g. [1.0, 0, 0]. Defaults to 50%
 *                 gray. The rendered color is the average of the existing pixel and 
 *                 the color passed into the filter.
 */
function grid(distance, color) {
    gl.grid = gl.grid || new Shader(null, '\
        uniform sampler2D texture;\
        uniform vec2 gridDistance;\
        uniform vec3 gridColor;\
        uniform vec2 texSize;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            \
            vec2 scaled = texCoord * texSize;\
            scaled.x = floor(scaled.x);\
            scaled.y = floor(scaled.y);\
            if (scaled.x == 0.0 || scaled.x == texSize.x - 1.0 || scaled.y == 0.0 || scaled.y == texSize.y - 1.0 || (mod(scaled.x, gridDistance.x) == 0.0) || (mod(scaled.y, gridDistance.y) == 0.0)) {\
                color.rgb = (color.rgb + gridColor) / 2.0;\
            }\
            \
            gl_FragColor = color;\
        }\
    ');

    if (distance == undefined)
        distance = [Math.round(this.width / 3), Math.round(this.height / 3)];

    if (color == undefined)
        color = [0.5, 0.5, 0.5];

    simpleShader.call(this, gl.grid, {
        gridDistance: distance,
        gridColor: color,
        texSize: [this.width, this.height]
    });

    return this;
}
