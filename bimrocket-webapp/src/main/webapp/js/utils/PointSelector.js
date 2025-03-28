/**
 * PointSelector.js
 *
 * @author realor
 */

import { Application } from "../ui/Application.js";
import { GeometryUtils } from "./GeometryUtils.js";
import { ObjectUtils } from "./ObjectUtils.js";
import { Solid } from "../core/Solid.js";
import { Profile } from "../core/Profile.js";
import { Cord } from "../core/Cord.js";
import { I18N } from "../i18n/I18N.js";
import { SolidGeometry } from "../core/SolidGeometry.js";
import * as THREE from "three";

class PointSelector
{
  static VERTEX_SNAP = 0;
  static INTERSECTION_SNAP = 1;
  static PROJECTION_SNAP = 2;
  static MIDDLE_POINT_SNAP = 3;
  static EDGE_SNAP = 4;
  static GUIDE_SNAP = 5;
  static FACE_SNAP = 6;

  // Object filter function for snap search that returns:
  // 0: ignore object and descendants
  // 1: explore object but not descendants
  // 2: ignore object but not descendants
  // 3: explore object and descendants

  static ANY_FILTER = () => 3;

  static VISIBLE_FILTER = object => object.visible ? 3 : 0;

  static VISIBLE_SELECTED_FILTER = (object, application) =>
    object.visible && application.selection.contains(object) ? 3 : 0;

  static VISIBLE_UNSELECTED_FILTER = (object, application) =>
    object.visible && !application.selection.contains(object) ? 3 : 0;

  static NO_SELECTION_ANCESTORS_FILTER = (object, application) =>
  {
    let selectedObject = application.selection.object;
    if (selectedObject)
    {
      if (object === selectedObject) return 1;

      if (ObjectUtils.isObjectDescendantOf(selectedObject, object)) return 2;
    }
    return object.visible ? 3 : 0;
  };

  constructor(application)
  {
    this.application = application;

    this.activated = false;

    this.snapDistance = 16;
    this.snapSize = 8;

    this.snapColors = [
      "black", // vertex
      "purple", // intersection
      "green", // projection
      "brown", // middle point
      "blue", // edge
      "orange", // axis
      "red" // face
    ];

    this.snaps = [];
    this.snap = null;
    this.projectionSnap = null;
    this.temporalSnap = null;
    this.snapTimestamp = 0;
    this.projectionSnapTime = 500; // 1/2 second to set the projection vertex

    this.auxiliaryPoints = []; // array of global Vector3
    this.auxiliaryLines = []; // array of global Line3

    this.touchPointerOffsetX = -40;
    this.touchPointerOffsetY = -40;

    this.debug = false;

    this.filter = PointSelector.VISIBLE_FILTER;

    this.axisGuides =
    [
      {
        label: "label.on_x_axis",
        startPoint: new THREE.Vector3(),
        endPoint: new THREE.Vector3(),
        startLocal : new THREE.Vector3(-1, 0, 0),
        endLocal : new THREE.Vector3(1, 0, 0),
        material : new THREE.LineBasicMaterial(
         { color: new THREE.Color(1, 0, 0),
           transparent: true,
           opacity : 0.4
         }),
        geometry: null
      },
      {
        label: "label.on_y_axis",
        startPoint: new THREE.Vector3(),
        endPoint: new THREE.Vector3(),
        startLocal : new THREE.Vector3(0, -1, 0),
        endLocal : new THREE.Vector3(0, 1, 0),
        material : new THREE.LineBasicMaterial(
         { color: new THREE.Color(0, 1, 0),
           transparent: true,
           opacity : 0.4
         }),
        geometry: null
      },
      {
        label: "label.on_z_axis",
        startPoint: new THREE.Vector3(),
        endPoint: new THREE.Vector3(),
        startLocal : new THREE.Vector3(0, 0, -1),
        endLocal : new THREE.Vector3(0, 0, 1),
        material : new THREE.LineBasicMaterial(
         { color: new THREE.Color(0, 0, 1),
           transparent: true,
           opacity : 0.4
         }),
        geometry: null
      }
    ];

    this.axisGuidesEnabled = false;
    this.axisMatrixWorld = new THREE.Matrix4();
    this.axisMatrixWorldInverse = new THREE.Matrix4();

    this.snapElem = document.createElement("div");
    const snapElem = this.snapElem;
    snapElem.style.position = "absolute";
    snapElem.style.display = "none";
    snapElem.style.width = this.snapSize + "px";
    snapElem.style.height = this.snapSize + "px";
    snapElem.style.zIndex = 10000;
    application.container.appendChild(snapElem);

    this.projectionSnapElem = document.createElement("div");
    const projectionSnapElem = this.projectionSnapElem;
    projectionSnapElem.style.position = "absolute";
    projectionSnapElem.style.display = "none";
    projectionSnapElem.style.width = this.snapSize + "px";
    projectionSnapElem.style.height = this.snapSize + "px";
    application.container.appendChild(projectionSnapElem);

    this._onPointerMove = this.onPointerMove.bind(this);
    this._onPointerUp = this.onPointerUp.bind(this);
  }

  activate()
  {
    if (!this.activated)
    {
      const application = this.application;
      const container = application.container;
      container.addEventListener('pointermove', this._onPointerMove, false);
      container.addEventListener('pointerup', this._onPointerUp, false);
      this.activated = true;
    }
  }

  deactivate()
  {
    if (this.activated)
    {
      const application = this.application;
      const container = application.container;
      container.removeEventListener('pointermove', this._onPointerMove, false);
      container.removeEventListener('pointerup', this._onPointerUp, false);
      this.snapElem.style.display = "none";
      this.activated = false;
    }
  }

  onPointerUp(event)
  {
    const application = this.application;

    if (!application.isCanvasEvent(event)) return;

    this.snapElem.style.display = "none";
    this.projectionSnapElem.style.display = "none";
  }

  onPointerMove(event)
  {
    const application = this.application;

    if (!application.isCanvasEvent(event)) return;

    const container = application.container;
    const snapElem = this.snapElem;
    const projectionSnapElem = this.projectionSnapElem;
    const projectionSnap = this.projectionSnap;

    let rect = container.getBoundingClientRect();
    const pointerPosition = new THREE.Vector2();
    pointerPosition.x = event.clientX - rect.left;
    pointerPosition.y = event.clientY - rect.top;

    if (pointerPosition.y < 0) return; // out of container

    if (event.pointerType === "touch")
    {
      pointerPosition.x += this.touchPointerOffsetX;
      pointerPosition.y += this.touchPointerOffsetY;
    }

    const snaps = this.findSnaps(pointerPosition);
    const snap = this.selectRelevantSnap(snaps);

    let updateTimestamp = true;

    if (snap)
    {
      snapElem.style.left = (snap.positionScreen.x - this.snapSize / 2) + "px";
      snapElem.style.top = (snap.positionScreen.y - this.snapSize / 2) + "px";
      snapElem.style.display = "";
      snapElem.style.border = "1px solid white";
      snapElem.style.borderRadius = "0";
      snapElem.style.backgroundColor = this.snapColors[snap.type];
      I18N.set(snapElem, "title", snap.label);
      application.i18n.update(snapElem);

      if (this.temporalSnap)
      {
        if (snap.positionScreen.equals(this.temporalSnap.positionScreen))
        {
          // do not update timestamp if the snap position does not change
          updateTimestamp = false;
        }

        if (Date.now() - this.snapTimestamp > this.projectionSnapTime)
        {
          // if pointer is on snap for more than projectionSnapTime then
          // save projectionSnap
          this.projectionSnap = this.temporalSnap;
        }
      }

      this.snap = snap;
      if (snap.type === PointSelector.VERTEX_SNAP ||
          snap.type === PointSelector.INTERSECTION_SNAP ||
          snap.type === PointSelector.MIDDLE_POINT_SNAP)
      {
        this.temporalSnap = snap;
      }
      else if (snap.type === PointSelector.PROJECTION_SNAP && projectionSnap)
      {
        const clientWidth = container.clientWidth;
        const clientHeight = container.clientHeight;

        let vector = new THREE.Vector3();
        vector.copy(projectionSnap.positionWorld).project(application.camera);
        let screenPosition = new THREE.Vector3();
        screenPosition.x = 0.5 * clientWidth * (vector.x + 1);
        screenPosition.y = 0.5 * clientHeight * (1 - vector.y);
        projectionSnapElem.style.left =
          (screenPosition.x - this.snapSize / 2) + "px";
        projectionSnapElem.style.top =
          (screenPosition.y - this.snapSize / 2) + "px";
        projectionSnapElem.style.display = "";
        projectionSnapElem.style.backgroundColor = "green";
        projectionSnapElem.style.borderRadius = this.snapSize + "px";
        projectionSnapElem.style.border = "1px solid white";
        this.temporalSnap = null;
      }
      else
      {
        projectionSnapElem.style.display = "none";
        this.temporalSnap = null;
      }
    }
    else
    {
      if (event.pointerType === "touch")
      {
        snapElem.style.left = (pointerPosition.x - this.snapSize / 2) + "px";
        snapElem.style.top = (pointerPosition.y - this.snapSize / 2) + "px";
        snapElem.style.display = "";
        snapElem.style.border = "1px solid black";
        snapElem.style.borderRadius = this.snapSize + "px";
        snapElem.style.backgroundColor = "transparent";
        snapElem.title = "";
      }
      else
      {
        snapElem.style.display = "none";
      }
      projectionSnapElem.style.display = "none";
      this.snap = null;
      this.temporalSnap = null;
    }

    if (updateTimestamp) this.snapTimestamp = Date.now();

    this.snaps = this.debug ? snaps : null;
  }

  setAxisGuides(axisMatrixWorld, visible = false)
  {
    this.axisGuidesEnabled = true;
    this.axisMatrixWorld.copy(axisMatrixWorld);
    this.axisMatrixWorldInverse.copy(axisMatrixWorld).invert();

    const axisLength = 1000;
    const scale = axisMatrixWorld.getMaxScaleOnAxis();
    const factor = axisLength / scale;

    let scaledAxisMatrixWorld = new THREE.Matrix4();
    scaledAxisMatrixWorld.makeScale(factor, factor, factor);
    scaledAxisMatrixWorld.premultiply(axisMatrixWorld);

    for (let guide of this.axisGuides)
    {
      guide.startPoint.copy(guide.startLocal)
        .applyMatrix4(scaledAxisMatrixWorld);
      guide.endPoint.copy(guide.endLocal)
        .applyMatrix4(scaledAxisMatrixWorld);
    }

    if (this.axisGroup)
    {
      this.application.removeObject(this.axisGroup);
      this.axisGroup = null;
    }

    if (visible)
    {
      this.axisGroup = new THREE.Group();
      this.axisGroup.name = "Axis guides";

      for (let guide of this.axisGuides)
      {
        if (guide.geometry === null)
        {
          let geometry = new THREE.BufferGeometry();
          geometry.setFromPoints([guide.startLocal, guide.endLocal]);
          guide.geometry = geometry;
        }
        let line = new THREE.Line(guide.geometry, guide.material);
        scaledAxisMatrixWorld.decompose(line.position, line.rotation, line.scale);
        line.updateMatrix();
        line.name = guide.label;
        line.raycast = function(){};

        this.axisGroup.add(line);
      }
      this.application.addObject(this.axisGroup, this.application.overlays);
    }
  }

  clearAxisGuides()
  {
    if (this.axisGroup)
    {
      this.application.removeObject(this.axisGroup);
      this.axisGroup = null;
    }
    this.axisGuidesEnabled = false;
  }

  findSnaps(pointerPosition)
  {
    const application = this.application;
    const camera = application.camera;
    const container = application.container;
    const clientWidth = container.clientWidth;
    const clientHeight = container.clientHeight;
    const baseObject = application.baseObject;

    const raycaster = new THREE.Raycaster();
    const positionWorld = new THREE.Vector3();
    const positionScreen = new THREE.Vector2();
    const triangleWorld =
      [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const vector = new THREE.Vector3();
    const point1 = new THREE.Vector3();
    const point2 = new THREE.Vector3();
    const sphere = new THREE.Sphere();

    const snapKeySet = new Set();
    let snaps = [];

    let pointercc = new THREE.Vector2();
    pointercc.x = (pointerPosition.x / container.clientWidth) * 2 - 1;
    pointercc.y = -(pointerPosition.y / container.clientHeight) * 2 + 1;

    raycaster.setFromCamera(pointercc, camera);
    raycaster.far = Math.Infinity;
    raycaster.camera = camera;

    const worldToScreen = (positionWorld, screenPosition) =>
    {
      vector.copy(positionWorld).project(camera);
      screenPosition.x = 0.5 * clientWidth * (vector.x + 1);
      screenPosition.y = 0.5 * clientHeight * (1 - vector.y);
    };

    const rayIntersectsObject = object =>
    {
      const geometry = object.geometry;
      const matrixWorld = object.matrixWorld;

      if (geometry === undefined) return false;

      if (geometry.boundingSphere === null) geometry.computeBoundingSphere();

      sphere.copy(geometry.boundingSphere);
      sphere.radius *= 1.2;
      sphere.applyMatrix4(matrixWorld);

      return raycaster.ray.intersectsSphere(sphere);
    };

    const isNewSnap = (type, snapPositionWorld) =>
    {
      const k = 10000;
      const snapKey = type + ":" +
        (Math.round(snapPositionWorld.x * k) / k) + "," +
        (Math.round(snapPositionWorld.y * k) / k) + "," +
        (Math.round(snapPositionWorld.z * k) / k);

      if (snapKeySet.has(snapKey))
      {
        return false;
      }
      else
      {
        snapKeySet.add(snapKey);
        return true;
      }
    };

    const addVertexSnap = (object, vertex, label, type) =>
    {
      positionWorld.copy(vertex);
      if (object)
      {
        positionWorld.applyMatrix4(object.matrixWorld);
      }
      worldToScreen(positionWorld, positionScreen);

      let distanceScreen = positionScreen.distanceTo(pointerPosition);
      if (distanceScreen < this.snapDistance)
      {
        if (isNewSnap(type, positionWorld))
        {
          snaps.push({
            label : label,
            type : type,
            object : object,
            positionScreen : positionScreen.clone(),
            distanceScreen : distanceScreen,
            positionWorld : positionWorld.clone(),
            distanceWorld : positionWorld.distanceTo(camera.position)
          });
        }
        return true;
      }
      return false;
    };

    const addEdgeSnap = (object, vertex1, vertex2, label, type) =>
    {
      const middlePoint = vector;
      middlePoint.addVectors(vertex1, vertex2).multiplyScalar(0.5);

      addVertexSnap(object, middlePoint, "label.on_middle_point",
        PointSelector.MIDDLE_POINT_SNAP);

      point1.copy(vertex1);
      point2.copy(vertex2);

      if (object)
      {
        const matrixWorld = object.matrixWorld;
        point1.applyMatrix4(matrixWorld);
        point2.applyMatrix4(matrixWorld);
      }

      const ds = raycaster.ray.distanceSqToSegment(point1, point2,
          null, positionWorld);
      if (ds < 0.1)
      {
        worldToScreen(positionWorld, positionScreen);
        let distanceScreen = positionScreen.distanceTo(pointerPosition);
        if (distanceScreen < this.snapDistance)
        {
          if (isNewSnap(type, positionWorld))
          {
            snaps.push({
              label : label,
              type : type,
              object : object,
              positionScreen : positionScreen.clone(),
              distanceScreen : distanceScreen,
              positionWorld : positionWorld.clone(),
              distanceWorld : positionWorld.distanceTo(camera.position),
              line : new THREE.Line3(point1.clone(), point2.clone())
            });
          }
          return true;
        }
      }
      return false;
    };

    const addTriangleSnap = (object, face, vertex1, vertex2, vertex3,
      label, type) =>
    {
      triangleWorld[0].copy(vertex1);
      triangleWorld[1].copy(vertex2);
      triangleWorld[2].copy(vertex3);

      if (object)
      {
        for (let i = 0; i < 3; i++)
        {
          triangleWorld[i].applyMatrix4(object.matrixWorld);
        }
      }

      if (raycaster.ray.intersectTriangle(
          triangleWorld[0], triangleWorld[1], triangleWorld[2],
          false, positionWorld) !== null)
      {
        if (isNewSnap(type, positionWorld))
        {
          let plane = new THREE.Plane();
          plane.setFromCoplanarPoints(triangleWorld[0], triangleWorld[1],
            triangleWorld[2]);

          snaps.push({
            label : label,
            type : type,
            object : object,
            positionScreen : pointerPosition.clone(),
            distanceScreen : 0,
            positionWorld : positionWorld.clone(),
            distanceWorld : positionWorld.distanceTo(camera.position),
            normalWorld : GeometryUtils.calculateNormal(triangleWorld),
            face : face,
            triangle : [ triangleWorld[0].clone(),
              triangleWorld[1].clone(), triangleWorld[2].clone() ],
            plane : plane
          });
        }
        return true;
      }
      return false;
    };

    const addSolidVertexSnaps = (object) =>
    {
      const vertices = object.geometry.vertices;

      for (let vertex of vertices)
      {
        addVertexSnap(object, vertex, "label.on_vertex",
          PointSelector.VERTEX_SNAP);
      }
    };

    const addSolidEdgeSnaps = (object) =>
    {
      const matrixWorld = object.matrixWorld;
      const geometry = object.geometry;

      for (let face of geometry.faces)
      {
        addSolidLoopEdgeSnaps(object, face.outerLoop);
        for (let hole of face.holes)
        {
          addSolidLoopEdgeSnaps(object, hole);
        }
      }
    };

    const addSolidLoopEdgeSnaps = (object, loop) =>
    {
      const isManifold = object.geometry.isManifold;
      const vertices = object.geometry.vertices;
      const matrixWorld = object.matrixWorld;
      const size = loop.getVertexCount();

      for (let i = 0; i < size; i++)
      {
        let index1 = loop.indices[i];
        let index2 = loop.indices[(i + 1) % size];
        if (isManifold && index1 > index2) continue;

        let vertex1 = vertices[index1];
        let vertex2 = vertices[index2];

        addEdgeSnap(object, vertex1, vertex2, "label.on_edge",
          PointSelector.EDGE_SNAP);
      }
    };

    const addSolidFaceSnaps = (object) =>
    {
      const matrixWorld = object.matrixWorld;
      const geometry = object.geometry;
      const vertices = geometry.vertices;

      for (let face of geometry.faces)
      {
        for (let indices of face.getTriangles())
        {
          if (addTriangleSnap(object, face,
             vertices[indices[0]], vertices[indices[1]], vertices[indices[2]],
            "label.on_face", PointSelector.FACE_SNAP))
          {
            break;
          }
        }
      }
    };

    const addProfileSnaps = (object) =>
    {
      const path = object.geometry.path;
      const points = path.getPoints(object.geometry.divisions);

      let vertex1 = point1;
      let vertex2 = point2;

      for (let i = 0; i < points.length; i++)
      {
        let p1 = points[i];
        let p2 = points[(i + 1) % points.length];

        vertex1.x = p1.x;
        vertex1.y = p1.y;
        vertex1.z = 0;

        vertex2.x = p2.x;
        vertex2.y = p2.y;
        vertex2.z = 0;

        addVertexSnap(object, vertex1, "label.on_vertex",
          PointSelector.VERTEX_SNAP);

        addEdgeSnap(object, vertex1, vertex2, "label.on_edge",
          PointSelector.EDGE_SNAP);
      }
    };

    const addCordSnaps = (object) =>
    {
      const vertices = object.geometry.points;

      let vertex1 = point1;
      let vertex2 = point2;

      for (let i = 0; i < vertices.length - 1; i++)
      {
        vertex1.copy(vertices[i]);
        vertex2.copy(vertices[i + 1]);

        addVertexSnap(object, vertex1, "label.on_vertex",
          PointSelector.VERTEX_SNAP);

        addEdgeSnap(object, vertex1, vertex2, "label.on_edge",
          PointSelector.EDGE_SNAP);
      }
      addVertexSnap(object, vertices[vertices.length - 1], "label.on_vertex",
        PointSelector.VERTEX_SNAP);
    };

    const addBufferGeometrySnaps = (object) =>
    {
      const matrixWorld = object.matrixWorld;
      const geometry = object.geometry;

      GeometryUtils.traverseBufferGeometryVertices(geometry, vertex =>
      {
        addVertexSnap(object, vertex, "label.on_vertex",
          PointSelector.VERTEX_SNAP);
      });
    };

    const addSceneSnaps = () =>
    {
      const traverse = object =>
      {
        let filterResult = this.filter(object, application);
        if ((filterResult & 1) === 1) // 1 or 3
        {
          if (rayIntersectsObject(object))
          {
            if (object instanceof Solid)
            {
              if (object.facesVisible || object.edgesVisible)
              {
                addSolidVertexSnaps(object);
                addSolidEdgeSnaps(object);
              }
              if (object.facesVisible)
              {
                addSolidFaceSnaps(object);
              }
            }
            else if (object instanceof Profile)
            {
              addProfileSnaps(object);
            }
            else if (object instanceof Cord)
            {
              addCordSnaps(object);
            }
            else if (object.geometry instanceof THREE.BufferGeometry)
            {
              addBufferGeometrySnaps(object);
            }
          }
        }

        // explore children
        if ((filterResult & 2) === 2) // 2 or 3
        {
          let start = object instanceof Solid ? 2 : 0;

          for (let i = start; i < object.children.length; i++)
          {
            traverse(object.children[i]);
          }
        }
      };
      traverse(baseObject);
    };

    const addProjectionSnaps = () =>
    {
      if (this.projectionSnap === null || !this.axisGuidesEnabled) return;

      let axisMatrixWorld = this.axisMatrixWorld;
      let axisMatrixWorldInverse = this.axisMatrixWorldInverse;

      let snapPositionWorld = this.projectionSnap.positionWorld;
      let snapPosition = new THREE.Vector3();
      snapPosition.copy(snapPositionWorld).applyMatrix4(axisMatrixWorldInverse);

      let point = new THREE.Vector3();

      point.set(snapPosition.x, 0, 0);
      point.applyMatrix4(axisMatrixWorld);
      addVertexSnap(null, point,
        "label.on_projected_vertex", PointSelector.PROJECTION_SNAP);

      point.set(0, snapPosition.y, 0);
      point.applyMatrix4(axisMatrixWorld);
      addVertexSnap(null, point,
        "label.on_projected_vertex", PointSelector.PROJECTION_SNAP);

      point.set(0, 0, snapPosition.z);
      point.applyMatrix4(axisMatrixWorld);
      addVertexSnap(null, point,
        "label.on_projected_vertex", PointSelector.PROJECTION_SNAP);

      point.set(0, snapPosition.y, snapPosition.z);
      point.applyMatrix4(axisMatrixWorld);
      addVertexSnap(null, point,
        "label.on_projected_vertex", PointSelector.PROJECTION_SNAP);

      point.set(snapPosition.x, 0, snapPosition.z);
      point.applyMatrix4(axisMatrixWorld);
      addVertexSnap(null, point,
        "label.on_projected_vertex", PointSelector.PROJECTION_SNAP);

      point.set(snapPosition.x, snapPosition.y, 0);
      point.applyMatrix4(axisMatrixWorld);
      addVertexSnap(null, point,
        "label.on_projected_vertex", PointSelector.PROJECTION_SNAP);
    };

    const addAuxiliaryPointSnaps = () =>
    {
      for (let auxiliaryPoint of this.auxiliaryPoints)
      {
        addVertexSnap(null, auxiliaryPoint, "label.on_vertex",
          PointSelector.VERTEX_SNAP);
      }
    };

    const addAuxiliaryLineSnaps = () =>
    {
      for (let auxiliaryLine of this.auxiliaryLines)
      {
        addEdgeSnap(null, auxiliaryLine.start, auxiliaryLine.end,
          "label.on_edge", PointSelector.EDGE_SNAP);
      }
    };

    const addAxisGuideSnaps = () =>
    {
      if (this.axisGuidesEnabled)
      {
        for (let guide of this.axisGuides)
        {
          addEdgeSnap(null, guide.startPoint, guide.endPoint,
            guide.label, PointSelector.GUIDE_SNAP);
        }
      }
    };

    const filterHiddenSnaps = () =>
    {
      // find the first face snap (closest to observer)
      let firstFaceSnap = null;

      for (let snap of snaps)
      {
        if (snap.type === PointSelector.FACE_SNAP)
        {
          if (firstFaceSnap === null ||
              snap.distanceWorld < firstFaceSnap.distanceWorld)
          {
            firstFaceSnap = snap;
          }
        }
      }
      if (firstFaceSnap === null) return;

      // discard snaps behind the plane of the first face snap
      const visibleSnaps = [];

      let plane = firstFaceSnap.plane;
      for (let snap of snaps)
      {
        if (plane.distanceToPoint(snap.positionWorld) >= -0.0001)
        {
          visibleSnaps.push(snap);
        }
      }
      snaps = visibleSnaps;
    };

    const addIntersectionSnaps = () =>
    {
      const interSnaps = [];
      const ray = new THREE.Ray();

      for (let snap1 of snaps)
      {
        if (!(snap1.type === PointSelector.EDGE_SNAP
              || snap1.type === PointSelector.GUIDE_SNAP))
          continue;

        for (let snap2 of snaps)
        {
          if (snap1 === snap2
             || (snap1.object === snap2.object && snap1.object))
            continue;

          if (snap2.type === PointSelector.FACE_SNAP)
          {
            // edge/guide - face intersection
            let edgeSnap = snap1;
            let faceSnap = snap2;
            let plane = faceSnap.plane;
            if (plane.intersectsLine(edgeSnap.line))
            {
              vector.subVectors(edgeSnap.line.end, edgeSnap.line.start);
              vector.normalize();
              ray.set(edgeSnap.line.start, vector);

              if (ray.intersectTriangle(
                faceSnap.triangle[0],
                faceSnap.triangle[1],
                faceSnap.triangle[2],
                false, positionWorld) !== null)
              {
                worldToScreen(positionWorld, positionScreen);
                let distanceScreen = positionScreen.distanceTo(pointerPosition);
                if (distanceScreen < this.snapDistance)
                {
                  let label = snap1.type === PointSelector.EDGE_SNAP ?
                    "label.on_edge_face" :
                    "label.on_guide_face";

                  interSnaps.push({
                    label :  label,
                    type : PointSelector.INTERSECTION_SNAP,
                    object : faceSnap.object || edgeSnap.object,
                    positionScreen : positionScreen.clone(),
                    distanceScreen : distanceScreen,
                    positionWorld : positionWorld.clone(),
                    distanceWorld : positionWorld.distanceTo(camera.position),
                    normalWorld : snap2.normalWorld,
                    snap1 : snap1,
                    snap2 : snap2
                  });
                }
              }
            }
          }
          else if (snap2.type === PointSelector.EDGE_SNAP)
          {
            // guide - edge intersection

            let distance = GeometryUtils.intersectLines(
              snap1.line, snap2.line, point1, point2);

            if (Math.abs(distance) < 0.0001)
            {
              positionWorld.copy(point1).add(point2).multiplyScalar(0.5);
              worldToScreen(positionWorld, positionScreen);
              let distanceScreen = positionScreen.distanceTo(pointerPosition);
              if (distanceScreen < this.snapDistance)
              {
                let label = snap1.type === PointSelector.EDGE_SNAP ?
                  "label.on_edge_edge" :
                  "label.on_guide_edge";

                interSnaps.push({
                  label : label,
                  type : PointSelector.INTERSECTION_SNAP,
                  object : snap1.object || snap2.object,
                  positionScreen : positionScreen.clone(),
                  distanceScreen : distanceScreen,
                  positionWorld : positionWorld.clone(),
                  distanceWorld : positionWorld.distanceTo(camera.position),
                  snap1 : snap1,
                  snap2 : snap2
                });
                continue;
              }
            }
          }
        }
      }
      snaps.push(...interSnaps);
    };

    const setSnapNormals = () =>
    {
      for (let snap1 of snaps)
      {
        if (snap1.type === PointSelector.FACE_SNAP)
        {
          for (let snap2 of snaps)
          {
            if (snap1.object === snap2.object)
              continue;

            if (snap2.type === PointSelector.VERTEX_SNAP
                || snap2.type === PointSelector.EDGE_SNAP
                || snap2.type === PointSelector.INTERSECTION_SNAP)
            {
              // does the face contains the vertex/egde ?
              let plane = snap1.plane;
              let distance = plane.distanceToPoint(snap2.positionWorld);
              if (Math.abs(distance) < 0.000001)
              {
                // copy face normal to vertex/edge snap
                snap2.normalWorld = snap1.normalWorld;
              }
            }
          }
        }
      }
    };

    addSceneSnaps();
    addProjectionSnaps();
    addAuxiliaryPointSnaps();
    addAuxiliaryLineSnaps();
    addAxisGuideSnaps();
    addIntersectionSnaps();
    filterHiddenSnaps();
    setSnapNormals();

    return snaps;
  }

  selectRelevantSnap(snaps)
  {
    if (snaps.length === 0) return null;

    let selectedSnap = snaps[0];
    for (let snap of snaps)
    {
      if (snap.type < selectedSnap.type ||
         (snap.type === selectedSnap.type &&
          snap.distanceScreen < selectedSnap.distanceScreen))
      {
        selectedSnap = snap;
      }
    }
    return selectedSnap;
  }
}

export { PointSelector };
