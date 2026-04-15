## Linux

- **Hard kernel cap per process (`ulimit -n` hard limit)**: governed by `fs.nr_open` (`/proc/sys/fs/nr_open`).
  - **Default** is typically **1,048,576**.
  - **Absolute max on common 64‑bit Linux** is about **2,147,483,584** (≈ \(2^{31}\), aligned), if you raise `fs.nr_open` that high.
- **System-wide cap (all processes)**: `fs.file-max` (`/proc/sys/fs/file-max`). This can be set very high, but you’ll hit **RAM pressure** first because each open file consumes kernel memory (file table entries, dentry/inode/socket state, etc.).

**“Maximum realistic” in production**: usually **hundreds of thousands to a few million FDs system-wide** on a big machine; **per-process** commonly set to **50k–1M** depending on workload. Setting tens/hundreds of millions is typically not realistic due to memory and performance overhead even if the integer limit allows it.

## macOS

macOS has **two main kernel sysctls**:

- **System-wide**: `kern.maxfiles`
- **Per-process**: `kern.maxfilesperproc`

Defaults vary by model/OS version; commonly you’ll see **~65,535** on some systems and **~245,760 system / 122,880 per-proc** on others.

macOS also layers **launchd session limits** on top:

- `launchctl limit maxfiles` (soft/hard), which influences what your shell/process can actually use even if the kernel sysctls are higher.

**“Maximum realistic” on macOS**: typically **tens of thousands to low hundreds of thousands per process**. You _can_ sometimes push higher, but in practice you’ll usually run into **performance/memory costs** and diminishing returns well before any theoretical “unlimited”.

## Quick check commands

- **Linux**
  - `ulimit -n`
  - `cat /proc/sys/fs/nr_open`
  - `cat /proc/sys/fs/file-max`
- **macOS**
  - `ulimit -n`
  - `sysctl kern.maxfiles kern.maxfilesperproc`
  - `launchctl limit maxfiles`
