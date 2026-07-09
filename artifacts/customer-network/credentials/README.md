# BizCor Conect — Release Signing Keystore

`bizcor-release.keystore` signs every published APK of BizCor Conect
(`com.naewtgroup.bizcorconect`).

**DO NOT DELETE OR REPLACE THIS FILE.** Android only installs an update over an
existing app if both APKs are signed with the same key. If this keystore is lost,
every customer must uninstall and reinstall the app manually — the in-app GitHub
update popup will stop working for them.

| Field          | Value                |
| -------------- | -------------------- |
| Keystore file  | `bizcor-release.keystore` |
| Alias          | `bizcor-connect`     |
| Store password | `bizcor2026release`  |
| Key password   | `bizcor2026release`  |
| Created        | 2026-07-09           |

The signing config is applied automatically during `expo prebuild` by
[`plugins/withReleaseSigning.js`](../plugins/withReleaseSigning.js) (registered in
`app.json`), so it survives regeneration of the gitignored `android/` folder.
