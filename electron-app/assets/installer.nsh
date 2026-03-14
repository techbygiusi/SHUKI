!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Var CleanUninstall
Var RadioKeep
Var RadioClean

; Custom uninstaller page
Function un.shukiDataPage
  !insertmacro MUI_HEADER_TEXT "Uninstall SHUKI" "Choose what to do with your SHUKI data"

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 24u "What would you like to do with your SHUKI data?"
  Pop $0

  ${NSD_CreateRadioButton} 10u 30u 100% 14u "Keep my settings and data"
  Pop $RadioKeep
  ${NSD_Check} $RadioKeep

  ${NSD_CreateLabel} 26u 46u 100% 12u "Uninstalls the app only. Your data stays for reinstall."
  Pop $0
  SetCtlColors $0 888888 transparent

  ${NSD_CreateRadioButton} 10u 66u 100% 14u "Remove everything (clean uninstall)"
  Pop $RadioClean

  ${NSD_CreateLabel} 26u 82u 100% 12u "Deletes all local notes, images, and settings."
  Pop $0
  SetCtlColors $0 888888 transparent

  StrCpy $CleanUninstall "0"

  nsDialogs::Show
FunctionEnd

Function un.shukiDataPageLeave
  ${NSD_GetState} $RadioClean $0
  ${If} $0 == ${BST_CHECKED}
    MessageBox MB_YESNO|MB_ICONQUESTION "This will permanently delete all local notes and settings.$\n$\nYour server data will not be affected.$\n$\nContinue?" IDYES +2
      Abort
    StrCpy $CleanUninstall "1"
  ${Else}
    StrCpy $CleanUninstall "0"
  ${EndIf}
FunctionEnd

; Register the custom page
!macro customUnInstallPage
  UninstPage custom un.shukiDataPage un.shukiDataPageLeave
!macroend

; After uninstall: clean up data directories if user chose "Remove everything"
!macro customUnInstall
  ${If} $CleanUninstall == "1"
    ; Remove Roaming AppData
    RMDir /r "$APPDATA\shuki"
    RMDir /r "$APPDATA\Shuki"

    ; Remove Local AppData
    RMDir /r "$LOCALAPPDATA\shuki"
    RMDir /r "$LOCALAPPDATA\shuki-updater"

    ; Remove electron userData (typically in Roaming/SHUKI or Roaming/shuki)
    RMDir /r "$APPDATA\SHUKI"
  ${EndIf}
!macroend
