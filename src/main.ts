import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as io from "@actions/io";
import { detectProjectVersion } from "./detect";
import { installGrFromRelease, installGrFromSource, installGrWithBinstall, installValgrind } from "./install";
import { getCargoBin, printErr } from "./utils";

/** Main entry point: validates environment, detects versions, and installs gungraun-runner and valgrind. */
async function run(): Promise<void> {
    if (process.platform !== "linux") {
        printErr("This action only supports Linux runners");
    }

    if (!(await io.which(getCargoBin(), false))) {
        printErr("cargo is not installed. This action requires Rust/Cargo.");
    }
    if (!(await io.which("rustc", false))) {
        printErr("rustc is not installed. This action requires Rust/Cargo.");
    }

    let runnerVersion = core.getInput("runner-version") || "auto";
    if (runnerVersion === "auto") {
        const detected = await detectProjectVersion();
        runnerVersion = `v${detected}`;
    }

    const valgrindPath = await io.which("valgrind", false);
    if (valgrindPath) {
        const { stdout } = await exec.getExecOutput("valgrind", ["--version"], {
            silent: true,
            ignoreReturnCode: true,
        });
        core.info(`Valgrind already installed: ${stdout.trim()} (${valgrindPath})`);
    } else {
        await installValgrind();
    }

    if (!(await installGrWithBinstall(runnerVersion))) {
        if (!(await installGrFromRelease(runnerVersion))) {
            core.warning(
                "Could not install from GitHub release, falling back to cargo install"
            );
            await installGrFromSource(runnerVersion);
        }
    }
}

run().catch((error) => {
    core.setFailed(`Action failed: ${(error as Error).message}`);
});