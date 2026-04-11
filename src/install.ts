import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as fs from "fs";
import * as io from "@actions/io";
import * as path from "path";
import { detectArch, detectPlatform, detectTarget } from "./detect";
import { downloadAndExtractGr, downloadAndExtractValgrind } from "./download";
import { cargoVersionFormat, resolveValgrindAssetName, resolveValgrindTag, resolveVersion } from "./resolve";
import { getCargoBin, logInstalledVersion, printErr, printWarning, withGroup } from "./utils";

const INSTALL_DIR = process.env.RUNNER_INSTALL_DIR ||
    (process.env.CARGO_HOME
        ? `${process.env.CARGO_HOME}/bin`
        : `${process.env.HOME || "/root"}/.cargo/bin`);

async function findBinary(dir: string, name: string): Promise<string | null> {
    const entries = fs.readdirSync(dir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
        if (entry.isFile() && entry.name === name) {
            return path.join(entry.parentPath || dir, entry.name);
        }
    }
    return null;
}

/** Installs gungraun-runner from a GitHub release archive. */
export async function installGrFromRelease(version: string): Promise<boolean> {
    const target = await detectTarget();

    return withGroup(`Downloading gungraun-runner '${version}'`, async () => {
        try {
            const tag = await resolveVersion(version);
            const extractDir = await downloadAndExtractGr(tag, target);

            const binaryPath = path.join(extractDir, "gungraun-runner");
            if (!fs.existsSync(binaryPath)) {
                const found = await findBinary(extractDir, "gungraun-runner");
                if (!found) {
                    core.error("Could not find gungraun-runner binary in archive");
                    return false;
                }
            }

            await exec.exec("chmod", ["+x", binaryPath]);
            await io.mv(binaryPath, path.join(INSTALL_DIR, "gungraun-runner"));

            await logInstalledVersion(
                path.join(INSTALL_DIR, "gungraun-runner"),
                "gungraun-runner"
            );
            return true;
        } catch (error) {
            core.info(`Failed to install from release: ${(error as Error).message}`);
            return false;
        }
    });
}

/** Installs gungraun-runner from source via cargo install. */
export async function installGrFromSource(version: string): Promise<void> {
    await withGroup("Installing gungraun-runner via cargo install", async () => {
        const formatted = cargoVersionFormat(version);
        const args = ["install", "gungraun-runner"];
        if (formatted) {
            args.push("--version", formatted);
        }
        await exec.exec(getCargoBin(), args);

        await logInstalledVersion("gungraun-runner", "gungraun-runner");
    });
}

/** Installs gungraun-runner via cargo-binstall if available. */
export async function installGrWithBinstall(version: string): Promise<boolean> {
    if (!(await io.which("cargo-binstall", false))) {
        return false;
    }

    return withGroup("Installing gungraun-runner via cargo-binstall", async () => {
        try {
            const formatted = cargoVersionFormat(version);
            const args = ["binstall", "-y"];
            if (formatted) {
                args.push(`gungraun-runner@${formatted}`);
            } else {
                args.push("gungraun-runner");
            }
            await exec.exec(getCargoBin(), args);

            const grPath = await io.which("gungraun-runner", false);
            if (grPath) {
                await logInstalledVersion("gungraun-runner", "gungraun-runner");
            }
            return true;
        } catch {
            return false;
        }
    });
}

/** Installs valgrind, trying the builder release first and falling back to the package manager. */
export async function installValgrind(): Promise<void> {
    if (!(await installValgrindFromBuilder())) {
        printWarning("Could not install valgrind from release, falling back to package manager");
        await installValgrindWithPackageManager();
    }
}

/** Installs valgrind from the gungraun/valgrind-builder GitHub release. */
export async function installValgrindFromBuilder(): Promise<boolean> {
    const target = await detectTarget();
    const arch = detectArch(target);
    const { platform } = detectPlatform();

    return withGroup("Installing valgrind from release", async () => {
        try {
            const tag = await resolveValgrindTag(
                process.env.VALGRIND_VERSION || "latest"
            );
            const assetName = await resolveValgrindAssetName(tag, arch, platform);
            if (!assetName) {
                core.info(`No valgrind release found for ${arch}-${platform}`);
                return false;
            }

            core.info(`Downloading valgrind ${tag} (${assetName})`);
            const extractDir = await downloadAndExtractValgrind(tag, assetName);

            await exec.exec("sudo", ["tar", "-xzf", path.join(extractDir, assetName), "-C", "/"]);

            await logInstalledVersion("valgrind", "valgrind");
            return true;
        } catch (error) {
            core.info(`Failed to install valgrind from release: ${(error as Error).message}`);
            return false;
        }
    });
}

/** Installs valgrind using the system package manager. */
export async function installValgrindWithPackageManager(): Promise<void> {
    await withGroup("Installing valgrind via package manager", async () => {
        const { packageManager } = detectPlatform();

        switch (packageManager) {
            case "apt-get":
                await exec.exec("sudo", ["apt-get", "update", "-qq"]);
                await exec.exec("sudo", ["apt-get", "install", "-y", "-qq", "valgrind"]);
                break;
            case "dnf":
                await exec.exec("sudo", ["dnf", "install", "-y", "valgrind"]);
                break;
            case "yum":
                try {
                    await exec.exec("sudo", ["yum", "install", "-y", "valgrind"]);
                } catch {
                    await exec.exec("sudo", ["dnf", "install", "-y", "valgrind"]);
                }
                break;
            case "pacman":
                await exec.exec("sudo", ["pacman", "-S", "--noconfirm", "valgrind"]);
                break;
            case "zypper":
                await exec.exec("sudo", ["zypper", "--non-interactive", "install", "valgrind"]);
                break;
            case "apk":
                await exec.exec("sudo", ["apk", "add", "valgrind"]);
                break;
            default:
                printErr("Unsupported distribution. Cannot install valgrind");
        }

        await logInstalledVersion("valgrind", "valgrind");
    });
}