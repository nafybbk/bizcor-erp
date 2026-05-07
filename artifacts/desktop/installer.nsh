; Custom NSIS macros for BizCor ERP installer

; Install se pehle: running instance ko band karo
!macro customInit
  ; Kill any running BizCor ERP process (taskkill silently, errors ignored)
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /IM "BizCor ERP.exe"'
  Sleep 2000
!macroend

; Uninstall ke waqt bhi running process band karo
!macro customUnInit
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /IM "BizCor ERP.exe"'
  Sleep 1500
!macroend
