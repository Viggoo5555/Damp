Unicode true
Name "Offcut"
Caption "Offcut Setup"
OutFile "Offcut-Setup-1.0.0.exe"
InstallDir "$LOCALAPPDATA\Programs\Offcut"
InstallDirRegKey HKCU "Software\Offcut" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 32
ShowInstDetails show
ShowUninstDetails show
BrandingText "Offcut - local clipping studio"

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Offcut (required)" SecInstall
  SectionIn RO
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /r "win-unpacked/*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateDirectory "$SMPROGRAMS\Offcut"
  CreateShortcut "$SMPROGRAMS\Offcut\Offcut.lnk" "$INSTDIR\Offcut.exe"
  CreateShortcut "$SMPROGRAMS\Offcut\Uninstall Offcut.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\Offcut.lnk" "$INSTDIR\Offcut.exe"

  WriteRegStr HKCU "Software\Offcut" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Offcut" "DisplayName" "Offcut"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Offcut" "DisplayVersion" "1.0.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Offcut" "Publisher" "Offcut"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Offcut" "DisplayIcon" "$INSTDIR\Offcut.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Offcut" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Offcut" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Offcut" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Offcut" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Offcut" "NoRepair" 1
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  Delete "$DESKTOP\Offcut.lnk"
  Delete "$SMPROGRAMS\Offcut\Offcut.lnk"
  Delete "$SMPROGRAMS\Offcut\Uninstall Offcut.lnk"
  RMDir "$SMPROGRAMS\Offcut"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Offcut"
  DeleteRegKey HKCU "Software\Offcut"
SectionEnd
