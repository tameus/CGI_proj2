import { buildProgramFromSources, loadShadersFromURLS, loadJSONFile, setupWebGL } from "../../libs/utils.js";
import { ortho, perspective, lookAt, flatten, mat4 } from "../../libs/MV.js";
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
    let mode = gl.TRIANGLES;

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);
    let uColorLocation = gl.getUniformLocation(program, "u_color");
    let mProjection = ortho(-1 * aspect, aspect, -1, 1, 0.01, 100);
    let mView = lookAt([2, 1.2, 1], [0, 0.6, 0], [0, 1, 0]);

    let zoom = 1.0;
    let isPerspective = false;
    let isOblique = false;
    let isMultiView = false;

    let tankTranslation = [0, 0, 0];
    let tankRotationY = 0;

    let oblAlpha = 45;
    let oblF = 0.5;

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
    const cannonConnectNode = findNode("cannon_connect", sceneGraph);
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
                color = [0.4, 0.4, 0.4, 1.0];
            } else {
                color = [0.8, 0.8, 0.7, 1.0];
            }
            let tileNode = {
                name: "tile_" + i + "_" + j,
                primitive: "CUBE",
                "color": color,
                transform: {
                    translation: [i * tileSize, -0.01, j * tileSize],
                    rotation: [0, 0, 0],
                    scale: [tileSize * 1, 0.01, tileSize * 1]
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
            case '8':
                isOblique = !isOblique;
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
                const forwardRotation = (tankRotationY * Math.PI) / 180;
                const step = 0.005;

                tankTranslation[2] += step * Math.cos(forwardRotation);
                tankTranslation[0] += step * Math.sin(forwardRotation);


                for (let node of wheelNodes) {
                    node.transform.rotation[1] += 1;
                }
                break;
            case 'e':

                const backRotation = (tankRotationY * Math.PI) / 180;
                const step2 = 0.005;

                tankTranslation[2] -= step2 * Math.cos(backRotation);
                tankTranslation[0] -= step2 * Math.sin(backRotation);

                for (let node of wheelNodes) {
                    node.transform.rotation[1] -= 1;
                }
                break;
            case 'w':
                //roda canhao para cima (eixo X)
                cannonConnectNode.transform.rotation[0] = Math.min(20, cannonConnectNode.transform.rotation[0] + 1);
                break;
            case 's':
                //roda canhao para baixo (eixo X)
                cannonConnectNode.transform.rotation[0] = Math.max(-50, cannonConnectNode.transform.rotation[0] - 1);
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

            if (mode === gl.TRIANGLES) {
                gl.enable(gl.POLYGON_OFFSET_FILL);
                gl.polygonOffset(1.0, 1.0);
                gl.uniform4fv(uColorLocation, [0.2, 0.2, 0.2, 1.0]);
                uploadModelView();
                primitive.draw(gl, program, gl.LINES);
            }
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
    function setAndUploadProjection(currentAspect, isView4) {
        const near = 0.01;
        const far = 100;

        const right = currentAspect * zoom;
        const left = -currentAspect * zoom;
        const top = zoom;
        const bottom = -zoom;

        //fazer a projecao
        if (isPerspective) {
            mProjection = perspective(60, currentAspect, near, far);
        } else {
            mProjection = ortho(left, right, bottom, top, near, far);

            if (isView4 && isOblique) {

                const rad = (Math.PI / 180) * oblAlpha;

                const cosA = Math.cos(rad);
                const sinA = Math.sin(rad);

                // A Matriz de Cisalhamento que simula o Oblíquo (aplicada ao sistema de coordenadas 3D)
                const shearMatrix = mat4.fromValues(
                    1, 0, 0, 0,
                    0, 1, 0, 0,
                    -oblF * cosA, -oblF * sinA, 1, 0,
                    0, 0, 0, 1)
                    ;

                mProjection = mat4.multiply(mProjection, mProjection, shearMatrix);
            }
        }
        uploadProjection();
    }

    function render() {
        window.requestAnimationFrame(render);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(program);

        if (Math.abs(ag) > 0.00001) {

            tankRotationY += (cabinNode.transform.rotation[1] - tankRotationY) * 0.05;
        }

        baseNode.transform.rotation[1] = tankRotationY;

        const radY = (tankRotationY * Math.PI) / 180;
        const dz = ag * Math.cos(radY); // Movimento ao longo do eixo Z
        const dx = ag * Math.sin(radY); // Movimento ao longo do eixo X

        tankTranslation[2] += dz;
        tankTranslation[0] += dx;

        // 4. Aplicar a Translação Global à base do modelo
        baseNode.transform.translation[0] = tankTranslation[0];
        baseNode.transform.translation[2] = tankTranslation[2];

        // 5. Rotação das Rodas (simulação de rolamento)
        // O fator de rotação depende da velocidade (ag) para simular o movimento
        const rotationFactor = -ag * 100; // Multiplicador para rotação ser visível
        for (let node of wheelNodes) {
            node.transform.rotation[1] += rotationFactor;
        }

        const w = canvas.width;
        const h = canvas.height;

        //multivista
        if (isMultiView) {
            const w2 = w / 2;
            const h2 = h / 2;
            const viewportAspect = w2 / h2;

            //frontal (canto inferior esquerdo)
            gl.viewport(0, 0, w2, h2);
            setAndUploadProjection(viewportAspect, false);
            drawScene(mViewFront);

            //cima (canto superior esquerdo)
            gl.viewport(0, h2, w2, h2);
            setAndUploadProjection(viewportAspect, false);
            drawScene(mViewTop);

            //esquerda (canto superior direito)
            gl.viewport(w2, h2, w2, h2);
            setAndUploadProjection(viewportAspect, false);
            drawScene(mViewLeft);

            //obliqua (canto inferior direito)
            gl.viewport(w2, 0, w2, h2);
            setAndUploadProjection(viewportAspect, true);
            drawScene(mViewOblique);
        } else {
            //vista unica (ecra inteiro)
            gl.viewport(0, 0, w, h);
            setAndUploadProjection(aspect, false);
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