# Comprobar si se ejecuta como administrador
if (-not ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(`
    [Security.Principal.WindowsBuiltInRole] "Administrator")) {

    Write-Host "Error: Ejecuta el script como Administrador"
    exit
}

Import-Module ActiveDirectory

# Configuración
$DOMAIN_DN = "DC=playbetter,DC=gg"
$LOGFILE = ".\registro.log"

if (!(Test-Path $LOGFILE)) {
    New-Item -ItemType File -Path $LOGFILE | Out-Null
}

# ================= FUNCIONES =================

function Convertir-RutaOU {
    param($ruta)

    if ([string]::IsNullOrEmpty($ruta)) { return "" }

    $partes = $ruta -split "/"
    [array]::Reverse($partes)

    return ($partes | ForEach-Object { "OU=$_"} ) -join ","
}

function Registrar-Accion {
    param($mensaje)
    $fecha = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LOGFILE -Value "$fecha - $mensaje"
}

function Generar-Contrasena {
    $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&"
    -join ((1..12) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

# ================= OU =================

function Crear-OU {
    $OU_NAME = Read-Host "Introduce el nombre de la OU"

    if ([string]::IsNullOrEmpty($OU_NAME)) {
        Write-Host "Error: nombre vacio"
        return
    }

    $PARENT_PATH = Read-Host "Ruta OU padre (ej: test1/test2) o vacio"

    if ([string]::IsNullOrEmpty($PARENT_PATH)) {
        $path = $DOMAIN_DN
    } else {
        $parentDN = Convertir-RutaOU $PARENT_PATH
        $path = "$parentDN,$DOMAIN_DN"
    }

    try {
        New-ADOrganizationalUnit -Name $OU_NAME -Path $path
        Write-Host "OU creada correctamente"
        Registrar-Accion "OU creada: OU=$OU_NAME,$path"
    } catch {
        Write-Host "Error al crear OU"
        Registrar-Accion "ERROR crear OU: $OU_NAME"
    }
}

function Borrar-OU {
    $OU_NAME = Read-Host "Nombre de la OU a borrar"

    try {
        Get-ADOrganizationalUnit -Filter "Name -eq '$OU_NAME'" | Remove-ADOrganizationalUnit -Recursive -Confirm:$false
        Write-Host "OU borrada"
        Registrar-Accion "OU borrada: $OU_NAME"
    } catch {
        Write-Host "Error al borrar OU"
    }
}

# ================= GRUPOS =================

function Crear-Grupo {
    $GROUP_NAME = Read-Host "Nombre del grupo"

    if ([string]::IsNullOrEmpty($GROUP_NAME)) {
        Write-Host "Error: nombre vacio"
        return
    }

    $GROUP_OU = Read-Host "OU del grupo (vacio = root)"

    if ([string]::IsNullOrEmpty($GROUP_OU)) {
        $path = $DOMAIN_DN
    } else {
        $ouDN = Convertir-RutaOU $GROUP_OU
        $path = "$ouDN,$DOMAIN_DN"
    }

    try {
        New-ADGroup -Name $GROUP_NAME -GroupScope Global -Path $path
        Write-Host "Grupo creado"
        Registrar-Accion "Grupo creado: $GROUP_NAME"
    } catch {
        Write-Host "Error al crear grupo"
    }
}

function Añadir-Usuario-Grupo {
    $GROUP_NAME = Read-Host "Nombre del grupo"
    $USER_NAME = Read-Host "Nombre del usuario"

    try {
        Add-ADGroupMember -Identity $GROUP_NAME -Members $USER_NAME
        Write-Host "Usuario incluido al grupo"
        Registrar-Accion "Usuario incluido: $USER_NAME -> $GROUP_NAME"
    } catch {
        Write-Host "Error al incluir usuario"
    }
}

# ================= USUARIOS =================

function Crear-Usuario {
    $USER_NAME = Read-Host "Nombre del usuario"

    if ([string]::IsNullOrEmpty($USER_NAME)) {
        Write-Host "Error: vacio"
        return
    }

    $USER_OU = Read-Host "Ruta OU (vacio = root)"

    if ([string]::IsNullOrEmpty($USER_OU)) {
        $path = $DOMAIN_DN
    } else {
        $ouDN = Convertir-RutaOU $USER_OU
        $path = "$ouDN,$DOMAIN_DN"
    }

    $password = Generar-Contrasena
    Write-Host "Contraseña: $password"

    $securePass = ConvertTo-SecureString $password -AsPlainText -Force

    try {
        New-ADUser `
            -Name $USER_NAME `
            -SamAccountName $USER_NAME `
            -UserPrincipalName "$USER_NAME@playbetter.gg" `
            -AccountPassword $securePass `
            -Enabled $true `
            -Path $path

        Write-Host "Usuario creado"
        Registrar-Accion "Usuario creado: $USER_NAME"
    } catch {
        Write-Host "Error al crear usuario"
    }
}

function Borrar-Usuario {
    $USER_NAME = Read-Host "Nombre del usuario"

    try {
        Remove-ADUser -Identity $USER_NAME -Confirm:$false
        Write-Host "Usuario borrado"
        Registrar-Accion "Usuario borrado: $USER_NAME"
    } catch {
        Write-Host "Error al borrar usuario"
    }
}

# ================= REPORTES =================

function Listar-Usuarios {
    Write-Host "`nUSUARIOS`n"
    Get-ADUser -Filter * | ForEach-Object {
        Write-Host "Usuario: $($_.SamAccountName)"
        Write-Host "DN: $($_.DistinguishedName)"
        Write-Host ""
    }
}

function Listar-Grupos {
    Write-Host "`nGRUPOS`n"
    Get-ADGroup -Filter * | ForEach-Object {
        Write-Host "Grupo: $($_.Name)"
        Write-Host "DN: $($_.DistinguishedName)"
        Write-Host ""
    }
}

# ================= MENÚ =================

$seguir = $true

while ($seguir) {

    Clear-Host
    Write-Host "===== MENU AD ====="
    Write-Host "1) OUs"
    Write-Host "2) Grupos"
    Write-Host "3) Usuarios"
    Write-Host "4) Reportes"
    Write-Host "5) Salir"

    $opcion = Read-Host "Opcion"

    switch ($opcion) {

        "1" {
            Write-Host "1 Crear OU"
            Write-Host "2 Borrar OU"
            $o = Read-Host "Opcion"

            if ($o -eq "1") { Crear-OU }
            elseif ($o -eq "2") { Borrar-OU }
        }

        "2" {
            Write-Host "1 Crear grupo"
            Write-Host "2 Incluir usuario a grupo"
            $o = Read-Host "Opcion"

            if ($o -eq "1") { Crear-Grupo }
            elseif ($o -eq "2") { Añadir-Usuario-Grupo }
        }

        "3" {
            Write-Host "1.Crear usuario"
            Write-Host "2.Borrar usuario"
            $o = Read-Host "Opcion: "

            if ($o -eq "1") { Crear-Usuario }
            elseif ($o -eq "2") { Borrar-Usuario }
        }

        "4" {
            Write-Host "1.Listar usuarios"
            Write-Host "2.Listar grupos"
            $o = Read-Host "Opcion: "

            if ($o -eq "1") { Listar-Usuarios }
            elseif ($o -eq "2") { Listar-Grupos }
        }

        "5" {
            $seguir = $false
        }

        default {
            Write-Host "Opcion incorrecta"
        }
    }

    Read-Host "Pulsa Enter para continuar"
}

Write-Host "Programa finalizado"