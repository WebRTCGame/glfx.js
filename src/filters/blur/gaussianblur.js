/**
 * @filter           Gaussian Blur
 * @description      Returns the blurred image.
 * @param size       Kernel size
 * @param sigma      Standard deviation
 */
function gaussian(size, sigma) {
    //We're gonna calculate the 2D kernel with the given parameters first
    //Using a 2D kernel is sooooo much more efficient than using a 3d kernel
    var values = new Array();
    var radius = Math.ceil(size/2);
    var halfradius = Math.ceil(radius/2);
    var sum = 0;
    for(var i = 0; i < size; i++) {
        var euler = 1/(Math.sqrt(2*Math.PI)*sigma);
        var pos = Math.abs(i-halfradius);
        var distance = (pos*pos)/(2*(sigma*sigma));
        var value = euler*Math.exp(-distance);
        values.push(value);
        sum += value;
    }
    var m = 1/sum;
    for(var i = 0; i < size; i++) {
        values[i] *= m;
    }
    
    //This looks pretty dirty, but since I'm a WebGL newbie, it's the only way I got it to run ... feel free to change it
    //We have to build two different fragment shaders, since we're using two 2D kernels instead of one 3D
    var fragmentx = '\
        uniform sampler2D texture;\
        varying vec2 texCoord;\
        void main(void) {\
            float gauss['+size+'];\
            ';
    for(var i = 0; i < size; i++) {
        fragmentx += '\
        gauss['+i+'] = '+values[i]+';\
        ';
    }
    fragmentx += '\
            vec3 values['+size+'];\
            vec3 sum = vec3(0.0, 0.0, 0.0);\
            vec2 pixel = vec2('+(1/this.width)+','+(1/this.height)+');\
        ';
    var fragmenty = fragmentx;
    fragmentx += '\
        vec2 pos = texCoord-vec2(pixel.x*'+halfradius+'.0, 0.0);\
    ';
    fragmenty += '\
        vec2 pos = texCoord-vec2(0.0, pixel.y*'+halfradius+'.0);\
    ';
    for(var i = 0; i < size; i++) {
        fragmentx += '\
            vec3 color'+i+' = texture2D(texture, pos).rgb;\
            sum += vec3(gauss['+i+'])*color'+i+';\
            pos += vec2(pixel.x, 0.0);\
        ';
        fragmenty += '\
            vec3 color'+i+' = texture2D(texture, pos).rgb;\
            sum += vec3(gauss['+i+'])*color'+i+';\
            pos += vec2(0.0, pixel.y);\
        ';
    }
    var b = '\
            gl_FragColor = vec4(sum, 1.0);\
        }\
    ';
    fragmentx += b;
    fragmenty += b;
    
    gl.gaussianx = gl.gaussianx || new Shader(null, fragmentx);
    gl.gaussiany = gl.gaussiany || new Shader(null, fragmenty);
    
    simpleShader.call(this, gl.gaussianx);
    simpleShader.call(this, gl.gaussiany);
    
    return this;
}