#!/bin/bash

ssh_exec() {
    ssh -i "$KEY_PATH" "$BASTION_USER@$1" "$2"
}

scp_to() {
    scp -i "$KEY_PATH" -r "$2" "$BASTION_USER@$1:$3"
}