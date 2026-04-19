https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md

Option 3, the safest way
If you have installed Google Chrome, the setuid sandbox helper (the old version of the sandbox) is available at /opt/google/chrome/chrome-sandbox. You can tell developer builds to use it by putting the following in your ~/.bashrc:

export CHROME_DEVEL_SANDBOX=/opt/google/chrome/chrome-sandbox
Ubuntu‘s packaged version of chromium will not install the setuid sandbox helper (it’s a snap package that disables the ubuntu security feature at runtime for its installed version of chromium).

If you have not installed Google Chrome, but you do have a chromium source checkout, you can build the SUID sandbox helper yourself and install it. This is the old version of the sandbox, but should work without disabling any Ubuntu security features. See [Linux SUID Sandbox Development] (https://chromium.googlesource.com/chromium/src/+/main/docs/linux/suid_sandbox_development.md) for instructions. This should work permanently.

The older version of the sandbox may be slightly weaker, and involves installing a setuid binary.
