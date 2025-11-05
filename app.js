import { buildProgramFromSources, loadShadersFromURLS, loadJSONFile, setupWebGL } from "../../libs/utils.js";
import { ortho, perspective, lookAt, flatten } from "../../libs/MV.js";
import { modelView, loadMatrix, multRotationX, multRotationY, multRotationZ, multScale, multTranslation, popMatrix, pushMatrix } from "../../libs/stack.js";

import * as CUBE from '../../libs/objects/cube.js';
import * as CYLINDER from '../../libs/objects/cylinder.js';
import * as TORUS from '../../libs/objects/torus.js';



function setup(shaders, sceneGraph) {
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    /** @type WebGL2RenderingContext */
    let gl = setupWebGL(canvas);

    // Drawing mode (gl.LINES or gl.TRIANGLES)
    let mode = gl.LINES;

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);
    let uColorLocation = gl.getUniformLocation(program, "u_color");
    let mProjection = ortho(-1 * aspect, aspect, -1, 1, 0.01, 100);
    let mView = lookAt([2, 1.2, 1], [0, 0.6, 0], [0, 1, 0]);

    let zoom = 1.0;
    let isPerspective = false;
    let isMultiView = false;
    const mViewFront = lookAt([0, 0.6, 2], [0, 0.6, 0], [0, 1, 0]);
    const mViewTop = lookAt([0, 2, 0], [0, 0.6, 0], [0, 0, -1]);
    const mViewLeft = lookAt([-2, 0.6, 0], [0, 0.6, 0], [0, 1, 0]);
    const mViewOblique = lookAt([2, 1.2, 1], [0, 0.6, 0], [0, 1, 0]);


    //recursivo para encontrar o no
    function findNode(name, node) {
        if (node.name === name) {
            return node;
        }
        for (let child of node.children) {
            let result = findNode(name, child);
            if (result) {
                return result;
            }
        }
        return null;
    }

    function createWheelNode(name, translation) {
        //no pai -> rotacao e translacao inicial (estatico), filho -> escala e rotacoes (animado)
        let pivot = {
            name: name + "_pivot",
            transform: {
                translation: translation,
                rotation: [90, 90, 0],
                scale: [1, 1, 1]
            },
            children: [
                {
                    name: name + "_model",
                    primitive: "TORUS",
                    "color": [0.0, 0.0, 0.0, 1.0],
                    transform: {
                        translation: [0, 0, 0],
                        rotation: [0, 0, 0],
                        scale: [0.15, 0.15, 0.15]
                    },
                    children: []
                }
            ]
        };
        return pivot
    }

    const cabinNode = findNode("cabin", sceneGraph);
    const cannonNode = findNode("cannon", sceneGraph);
    const baseNode = findNode("base", sceneGraph);
    let wheelNodes = [];
    let x_left = -0.45;
    let x_right = 0.45;
    let y_pos = 0.1;
    let z_start = -0.7;
    let z_spacing = 0.28;
    for (let i = 0; i < 12; i++) {
        let name = "wheel_L";
        let x = x_left;
        if (i < 6) {
            name = "wheel_R"
            x = x_right;
        }
        let index = i % 6;
        let wheelName = name + index;
        let z_pos = z_start + index * z_spacing;
        let wheel = createWheelNode(wheelName, [x, y_pos, z_pos])
        baseNode.children.push(wheel);
        //apenas o no animado
        wheelNodes.push(wheel.children[0]);
    }
    const gridSize = 10;
    const tileSize = 0.5;
    for (let i = -gridSize; i <= gridSize; i++) {
        for (let j = -gridSize; j <= gridSize; j++) {
            let color;
            if ((i + j) % 2 === 0) {
                color = [0.0, 0.0, 0.0, 1.0];
            } else {
                color = [1.0, 1.0, 1.0, 1.0];
            }
            let tileNode = {
                name: "tile_" + i + "_" + j,
                primitive: "CUBE",
                "color": color,
                transform: {
                    translation: [i * tileSize, -0.01, j * tileSize],
                    rotation: [0, 0, 0],
                    scale: [tileSize * 0.95, 0.01, tileSize * 0.95]
                },
                children: []
            };
            sceneGraph.children.push(tileNode);
        }
    }

    /** Model parameters */
    let ag = 0;
    let rg = 0;
    let rb = 0;
    let rc = 0;

    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    document.onkeydown = function (event) {
        switch (event.key) {
            case '0':
                //altera modo de vista 
                isMultiView = !isMultiView;
                break;
            case '1':
                //vista frontal
                mView = mViewFront;
                isMultiView = false;
                break;
            case '2':
                ///vista para esquerda
                mView = mViewLeft;
                isMultiView = false;
                break;
            case '3':
                //vista para cima
                mView = mViewTop;
                isMultiView = false;
                break;
            case '4':
                //vista obliqua
                mView = mViewOblique;
                isMultiView = false;
                break;
            case '9':
                isPerspective = !isPerspective;
                break;
            case '0':
                break;
            case ' ':
                if (mode === gl.LINES) {
                    mode = gl.TRIANGLES;
                } else {
                    mode = gl.LINES;
                }
                break;
            case 'p':
                ag = Math.min(0.050, ag + 0.005);
                break;
            case 'o':
                ag = Math.max(0, ag - 0.005);
                break;
            case 'q':
                for (let node of wheelNodes) {
                    node.transform.rotation[1] += 1;
                }
                break;
            case 'e':
                for (let node of wheelNodes) {
                    node.transform.rotation[1] -= 1;
                }
                break;
            case 'w':
                //roda canhao para cima (eixo X)
                cannonNode.transform.rotation[0] = Math.min(110, cannonNode.transform.rotation[0] + 1);
                break;
            case 's':
                //roda canhao para baixo (eixo X)
                cannonNode.transform.rotation[0] = Math.max(70, cannonNode.transform.rotation[0] - 1);
                break;
            case 'a':
                //roda cabine para esquerda (eixo Y)
                cabinNode.transform.rotation[1] -= 1;
                break;
            case 'd':
                //roda cabine para direita (eixo Y)
                cabinNode.transform.rotation[1] += 1;
                break;
            case '+':
                zoom /= 1.1;
                break;
            case '-':
                zoom *= 1.1;
                break;
        }
    }

    gl.clearColor(0.53, 0.81, 0.92, 1.0);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test

    CUBE.init(gl);
    CYLINDER.init(gl);
    TORUS.init(gl);

    window.requestAnimationFrame(render);


    function resize_canvas(event) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

    }

    const primitives = {
        "CUBE": CUBE,
        "CYLINDER": CYLINDER,
        "TORUS": TORUS
    }

    //para cada no
    function traverse(node) {
        //mete
        pushMatrix();
        //transformacoes na ordem certa
        const t = node.transform.translation;
        const r = node.transform.rotation;
        const s = node.transform.scale;
        multTranslation(t);
        multRotationZ(r[2]);
        multRotationY(r[1]);
        multRotationX(r[0]);
        multScale(s);
        //no e primitaiva -> desenhar
        if (node.primitive) {
            const primitive = primitives[node.primitive];
            let color = [1.0, 1.0, 1.0, 1.0];
            if (node.color) {
                color = node.color;
            }
            gl.uniform4fv(uColorLocation, color);
            uploadModelView();
            primitive.draw(gl, program, mode);
        }
        //vai buscar todos os filhos
        for (let child of node.children) {
            traverse(child);
        }
        //restaura
        popMatrix();
    }

    function uploadProjection() {
        uploadMatrix("u_projection", mProjection);
    }

    function uploadModelView() {
        uploadMatrix("u_model_view", modelView());
    }

    function uploadMatrix(name, m) {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, name), false, flatten(m));
    }
    function drawScene(viewMatrix) {
        //criar a cena
        loadMatrix(viewMatrix);
        traverse(sceneGraph);
    }
    function setAndUploadProjection(currentAspect) {
        //fazer a projecao
        if (isPerspective) {
            mProjection = perspective(60, currentAspect, 0.01, 100);
        } else {
            mProjection = ortho(-currentAspect * zoom, currentAspect * zoom, -zoom, zoom, 0.01, 100);
        }
        uploadProjection();
    }

    function render() {
        window.requestAnimationFrame(render);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(program);

        const w = canvas.width;
        const h = canvas.height;

        //multivista
        if (isMultiView) {
            const w2 = w / 2;
            const h2 = h / 2;
            const viewportAspect = w2 / h2;

            //frontal (canto inferior esquerdo)
            gl.viewport(0, 0, w2, h2);
            setAndUploadProjection(viewportAspect);
            drawScene(mViewFront);

            //cima (canto superior esquerdo)
            gl.viewport(0, h2, w2, h2);
            setAndUploadProjection(viewportAspect);
            drawScene(mViewTop);

            //esquerda (canto superior direito)
            gl.viewport(w2, h2, w2, h2);
            setAndUploadProjection(viewportAspect);
            drawScene(mViewLeft);

            //obliqua (canto inferior direito)
            gl.viewport(w2, 0, w2, h2);
            setAndUploadProjection(viewportAspect);
            drawScene(mViewOblique);
        } else {
            //vista unica (ecra inteiro)
            gl.viewport(0, 0, w, h);
            setAndUploadProjection(aspect);
            drawScene(mView);
        }
    }
}

const shader_urls = ["shader.vert", "shader.frag"];
const scene_url = "scene.json";

loadShadersFromURLS(shader_urls).then(shaders => {
    loadJSONFile(scene_url).then(sceneData => {
        setup(shaders, sceneData);
    });
});