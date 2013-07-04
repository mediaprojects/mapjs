/*
Need to add these to map model
mapModel.idea() - returns current idea
mapModel.isEditingEnabled()
mapModel.layout()
*/

/*global MAPJS*/
MAPJS.dragdrop = function (mapModel, analytic, stage) {
	'use strict';
	var currentDroppable,
		updateCurrentDroppable = function (value) {
			if (currentDroppable !== value) {
				if (currentDroppable) {
					mapModel.dispatchEvent('nodeDroppableChanged', currentDroppable, false);
				}
				currentDroppable = value;
				if (currentDroppable) {
					mapModel.dispatchEvent('nodeDroppableChanged', currentDroppable, true);
				}
			}
		},
		canDropOnNode = function (id, x, y, node) {
			/*jslint eqeq: true*/
			return id != node.id &&
				x >= node.x &&
				y >= node.y &&
				x <= node.x + node.width - 2 * 10 &&
				y <= node.y + node.height - 2 * 10;
		},
		tryFlip = function (rootNode, nodeBeingDragged, nodeDragEndX) {
			var flipRightToLeft = rootNode.x < nodeBeingDragged.x && nodeDragEndX < rootNode.x,
				flipLeftToRight = rootNode.x > nodeBeingDragged.x && rootNode.x < nodeDragEndX;
			if (flipRightToLeft || flipLeftToRight) {
				return mapModel.idea().flip(nodeBeingDragged.id);
			}
			return false;
		},
		nodeDragMove = function (id, x, y) {
			var nodeId, node;

			if (!mapModel.isEditingEnabled()) {
				return;
			}

			for (nodeId in mapModel.layout().nodes) {
				node = mapModel.layout().nodes[nodeId];
				if (canDropOnNode(id, x, y, node)) {
					updateCurrentDroppable(nodeId);
					return;
				}
			}
			updateCurrentDroppable(undefined);
		},
		nodeDragEnd = function (id, x, y, shouldCopy) {
			var nodeBeingDragged = mapModel.layout().nodes[id],
				nodeId,
				node,
				rootNode = mapModel.layout().nodes[mapModel.idea().id],
				verticallyClosestNode = { id: null, y: Infinity },
				clone;
			if (!mapModel.isEditingEnabled()) {
				mapModel.dispatchEvent('nodeMoved', nodeBeingDragged, 'failed');
				return;
			}
			updateCurrentDroppable(undefined);

			mapModel.dispatchEvent('nodeMoved', nodeBeingDragged);
			for (nodeId in mapModel.layout().nodes) {
				node = mapModel.layout().nodes[nodeId];
				if (canDropOnNode(id, x, y, node)) {
					if (shouldCopy) {
						clone = mapModel.idea().clone(id);
						if (!clone || !mapModel.idea().paste(nodeId, clone)) {
							mapModel.dispatchEvent('nodeMoved', nodeBeingDragged, 'failed');
							analytic('nodeDragCloneFailed');
						}
					} else if (!mapModel.idea().changeParent(id, nodeId)) {
						mapModel.dispatchEvent('nodeMoved', nodeBeingDragged, 'failed');
						analytic('nodeDragParentFailed');
					}
					return;
				}
				if ((nodeBeingDragged.x === node.x || nodeBeingDragged.x + nodeBeingDragged.width === node.x + node.width) && y < node.y) {
					if (!verticallyClosestNode || node.y < verticallyClosestNode.y) {
						verticallyClosestNode = node;
					}
				}
			}
			if (tryFlip(rootNode, nodeBeingDragged, x)) {
				return;
			}
			if (mapModel.idea().positionBefore(id, verticallyClosestNode.id)) {
				return;
			}
			mapModel.dispatchEvent('nodeMoved', nodeBeingDragged, 'failed');
			analytic('nodeDragFailed');
		},
		screenToStageCoordinates = function (x, y) {
			return {
				x: (x - stage.attrs.x) / (stage.getScale().x || 1),
				y: (y - stage.attrs.y) / (stage.getScale().y || 1)
			};
		},
		getInteractionPoint = function (evt) {
			if (evt.changedTouches && evt.changedTouches[0]) {
				return screenToStageCoordinates(evt.changedTouches[0].clientX, evt.changedTouches[0].clientY);
			}
			return screenToStageCoordinates(evt.layerX, evt.layerY);
		};
	mapModel.addEventListener('nodeCreated', function (n) {
		var node = stage.get('#node_' + n.id);
		node.on('dragstart', function () {
			node.moveToTop();
			node.setShadowOffset(8);
			node.attrs.opacity = 0.3;
		});
		node.on('dragmove', function (evt) {
			var stagePoint = getInteractionPoint(evt);
			nodeDragMove(
				n.id,
				stagePoint.x,
				stagePoint.y
			);
		});
		node.on('dragend', function (evt) {
			var stagePoint = getInteractionPoint(evt);
			node.setShadowOffset(4);
			node.attrs.opacity = 1;
			nodeDragEnd(
				n.id,
				stagePoint.x,
				stagePoint.y,
				evt.shiftKey
			);
		});
	});
};