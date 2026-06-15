#!/usr/bin/env python3
"""
utils/backup_ui.py

Interfaz gráfica (tkinter) para gestionar los backups de la base de datos.

Funciones disponibles:
  - Crear backup (local o cloud) ejecutando backup_db.sh
  - Descomprimir el backup .sql.gz más reciente del directorio backups/
"""

import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import subprocess
import threading
import glob
import os

# ─── Rutas ────────────────────────────────────────────────────────────────────
# El script vive en utils/; el raíz del repo está un nivel arriba
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT  = os.path.dirname(SCRIPT_DIR)
BACKUP_DIR = os.path.join(REPO_ROOT, "backups")
BACKUP_SH  = os.path.join(SCRIPT_DIR, "backup_db.sh")


# ─── Helpers ──────────────────────────────────────────────────────────────────

def ultimo_backup() -> str | None:
    """Devuelve la ruta del .sql.gz más reciente en backups/, o None si no hay ninguno."""
    archivos = glob.glob(os.path.join(BACKUP_DIR, "*.sql.gz"))
    if not archivos:
        return None
    return max(archivos, key=os.path.getmtime)


def _escribir_log(widget: scrolledtext.ScrolledText, texto: str) -> None:
    """Añade texto al widget de log y hace scroll al final."""
    widget.config(state=tk.NORMAL)
    widget.insert(tk.END, texto)
    widget.see(tk.END)
    widget.config(state=tk.DISABLED)


# ─── Acciones en hilo secundario ──────────────────────────────────────────────

def _ejecutar_backup(modo: str, log: scrolledtext.ScrolledText,
                     btn_backup: tk.Button, btn_descomprimir: tk.Button) -> None:
    """
    Lanza backup_db.sh <modo> en un subproceso y vuelca la salida al log.
    Se ejecuta en un hilo para no bloquear la interfaz.
    """
    _escribir_log(log, f"\n{'─'*60}\n")
    _escribir_log(log, f">> Iniciando backup [{modo}]...\n\n")

    try:
        proceso = subprocess.Popen(
            ["bash", BACKUP_SH, modo],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=REPO_ROOT,
        )

        # Leer la salida línea a línea para mostrarla en tiempo real
        for linea in proceso.stdout:
            _escribir_log(log, linea)

        proceso.wait()

        if proceso.returncode == 0:
            _escribir_log(log, "\n✔ Backup completado correctamente.\n")
        else:
            _escribir_log(log, f"\n✘ El script terminó con código de error {proceso.returncode}.\n")

    except FileNotFoundError:
        _escribir_log(log, f"\n✘ No se encontró el script: {BACKUP_SH}\n")
    except Exception as e:
        _escribir_log(log, f"\n✘ Error inesperado: {e}\n")
    finally:
        # Reactivar botones al terminar
        btn_backup.config(state=tk.NORMAL)
        btn_descomprimir.config(state=tk.NORMAL)


def _ejecutar_descompresion(log: scrolledtext.ScrolledText,
                             btn_backup: tk.Button, btn_descomprimir: tk.Button) -> None:
    """
    Busca el .sql.gz más reciente y lo descomprime con gunzip -k
    (mantiene el original). Se ejecuta en un hilo secundario.
    """
    _escribir_log(log, f"\n{'─'*60}\n")

    archivo = ultimo_backup()
    if not archivo:
        _escribir_log(log, "✘ No se encontró ningún backup .sql.gz en backups/.\n")
        btn_backup.config(state=tk.NORMAL)
        btn_descomprimir.config(state=tk.NORMAL)
        return

    _escribir_log(log, f">> Descomprimiendo: {os.path.basename(archivo)}\n\n")

    try:
        resultado = subprocess.run(
            ["gunzip", "-k", "-f", archivo],
            capture_output=True,
            text=True,
        )

        if resultado.returncode == 0:
            destino = archivo.removesuffix(".gz")
            _escribir_log(log, f"✔ Backup descomprimido en:\n   {destino}\n")
        else:
            _escribir_log(log, f"✘ Error al descomprimir:\n   {resultado.stderr}\n")

    except FileNotFoundError:
        _escribir_log(log, "✘ El comando 'gunzip' no está disponible en el sistema.\n")
    except Exception as e:
        _escribir_log(log, f"✘ Error inesperado: {e}\n")
    finally:
        btn_backup.config(state=tk.NORMAL)
        btn_descomprimir.config(state=tk.NORMAL)


# ─── Callbacks de los botones ─────────────────────────────────────────────────

def on_crear_backup(modo_var: tk.StringVar, log: scrolledtext.ScrolledText,
                    btn_backup: tk.Button, btn_descomprimir: tk.Button) -> None:
    """Deshabilita los botones y lanza el backup en un hilo secundario."""
    modo = modo_var.get()
    btn_backup.config(state=tk.DISABLED)
    btn_descomprimir.config(state=tk.DISABLED)

    hilo = threading.Thread(
        target=_ejecutar_backup,
        args=(modo, log, btn_backup, btn_descomprimir),
        daemon=True,
    )
    hilo.start()


def on_descomprimir(log: scrolledtext.ScrolledText,
                    btn_backup: tk.Button, btn_descomprimir: tk.Button) -> None:
    """Confirma con el usuario y lanza la descompresión en un hilo secundario."""
    archivo = ultimo_backup()
    nombre = os.path.basename(archivo) if archivo else "(ninguno)"

    confirmar = messagebox.askyesno(
        "Confirmar descompresión",
        f"Se descomprimirá el backup más reciente:\n\n{nombre}\n\n¿Continuar?",
    )
    if not confirmar:
        return

    btn_backup.config(state=tk.DISABLED)
    btn_descomprimir.config(state=tk.DISABLED)

    hilo = threading.Thread(
        target=_ejecutar_descompresion,
        args=(log, btn_backup, btn_descomprimir),
        daemon=True,
    )
    hilo.start()


# ─── Construcción de la interfaz ──────────────────────────────────────────────

def construir_ui() -> None:
    """Crea y lanza la ventana principal de tkinter."""
    ventana = tk.Tk()
    ventana.title("Gestión de Backups — GetBetter DB")
    ventana.resizable(True, True)
    ventana.minsize(600, 420)

    # Padding general
    marco = ttk.Frame(ventana, padding=16)
    marco.pack(fill=tk.BOTH, expand=True)

    # ── Selector de modo ──────────────────────────────────────────────────────
    ttk.Label(marco, text="Modo de conexión:").grid(row=0, column=0, sticky=tk.W, pady=(0, 4))

    modo_var = tk.StringVar(value="local")
    frame_modo = ttk.Frame(marco)
    frame_modo.grid(row=0, column=1, sticky=tk.W, pady=(0, 4))

    ttk.Radiobutton(frame_modo, text="Local (Docker)", variable=modo_var, value="local").pack(side=tk.LEFT, padx=(0, 12))
    ttk.Radiobutton(frame_modo, text="Cloud (AWS)",    variable=modo_var, value="cloud").pack(side=tk.LEFT)

    # ── Botones principales ───────────────────────────────────────────────────
    frame_botones = ttk.Frame(marco)
    frame_botones.grid(row=1, column=0, columnspan=2, pady=12)

    btn_backup       = ttk.Button(frame_botones, text="Crear backup",               width=26)
    btn_descomprimir = ttk.Button(frame_botones, text="Descomprimir último backup", width=26)

    btn_backup.pack(side=tk.LEFT, padx=8)
    btn_descomprimir.pack(side=tk.LEFT, padx=8)

    # Asignar comandos una vez creados ambos botones (se referencian mutuamente)
    btn_backup.config(
        command=lambda: on_crear_backup(modo_var, log, btn_backup, btn_descomprimir)
    )
    btn_descomprimir.config(
        command=lambda: on_descomprimir(log, btn_backup, btn_descomprimir)
    )

    # ── Área de log ───────────────────────────────────────────────────────────
    ttk.Label(marco, text="Log de operaciones:").grid(row=2, column=0, columnspan=2, sticky=tk.W)

    log = scrolledtext.ScrolledText(
        marco,
        height=18,
        state=tk.DISABLED,
        font=("Monospace", 9),
        wrap=tk.WORD,
        background="#1e1e1e",
        foreground="#d4d4d4",
        insertbackground="#ffffff",
    )
    log.grid(row=3, column=0, columnspan=2, sticky=tk.NSEW, pady=(4, 0))

    # Mensaje de bienvenida en el log
    ultimo = ultimo_backup()
    bienvenida = "Listo. Selecciona modo y pulsa un botón.\n"
    if ultimo:
        bienvenida += f"Último backup: {os.path.basename(ultimo)}\n"
    else:
        bienvenida += "No se encontraron backups previos en backups/.\n"
    _escribir_log(log, bienvenida)

    # La columna 1 y la fila 3 absorben el espacio extra al redimensionar
    marco.columnconfigure(1, weight=1)
    marco.rowconfigure(3, weight=1)

    ventana.mainloop()


# ─── Punto de entrada ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    construir_ui()
