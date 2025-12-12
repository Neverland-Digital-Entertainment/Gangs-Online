import * as BABYLON from "@babylonjs/core";
import { weaponConfig } from "../config";

/**
 * 武器系統
 * 負責武器的創建和附加到角色
 */
export class WeaponSystem {
    /**
     * 附加武器到角色
     */
    attachWeapon(
        rootMesh: BABYLON.AbstractMesh,
        skinnedMesh: BABYLON.AbstractMesh,
        scene: BABYLON.Scene
    ): void {
        // Create a wooden bat (cylinder)
        const bat = BABYLON.MeshBuilder.CreateCylinder(
            "bat",
            {
                height: weaponConfig.bat.height,
                diameter: weaponConfig.bat.diameter
            },
            scene
        );

        const mat = new BABYLON.StandardMaterial("batMat", scene);
        mat.diffuseColor = BABYLON.Color3.FromHexString(weaponConfig.bat.color);
        mat.emissiveColor = new BABYLON.Color3(
            weaponConfig.bat.emissiveColor.r,
            weaponConfig.bat.emissiveColor.g,
            weaponConfig.bat.emissiveColor.b
        );
        bat.material = mat;

        // Try to find skeleton on the skinned mesh
        const skeleton = skinnedMesh.skeleton;
        if (skeleton) {
            // Try to find hand bone - HVGirl model may have different bone names
            const handBone = skeleton.bones.find(
                (b) =>
                    b.name.toLowerCase().includes("righthand") ||
                    b.name.toLowerCase().includes("r_hand") ||
                    b.name.toLowerCase().includes("hand_r") ||
                    b.name.toLowerCase().includes("mixamorig:righthand")
            );

            if (handBone) {
                bat.attachToBone(handBone, skinnedMesh);
                bat.position = new BABYLON.Vector3(0, 0.1, 0);
                bat.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0); // Point outward
                return;
            }
        }

        // Fallback: Parent to root and position near where hand would be
        // Since the model is scaled to 0.15, we need to account for that
        bat.parent = rootMesh;
        bat.position = new BABYLON.Vector3(2, 8, 0); // Position relative to root (in model scale)
        bat.rotation = new BABYLON.Vector3(0, 0, Math.PI / 4);
    }
}
