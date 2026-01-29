# SSH Public Keys

This directory is for storing SSH public keys that should be added to the deploy user's `authorized_keys` file.

## Usage

1. Add your SSH public keys to this directory:

   ```bash
   cp ~/.ssh/id_rsa.pub keys/your-name.pub
   ```

2. The `setup-api.yml` playbook will automatically add all `*.pub` files in this directory to the deploy user.

## Security Note

⚠️ **Only add PUBLIC keys (.pub files) here, never private keys!**

- ✅ Good: `id_rsa.pub`, `admin.pub`
- ❌ Bad: `id_rsa`, `id_ed25519`

## Example

```bash
# Generate a new SSH key pair
ssh-keygen -t ed25519 -C "your-email@example.com" -f ~/.ssh/restomarket_deploy

# Copy public key to this directory
cp ~/.ssh/restomarket_deploy.pub infrastructure/ansible/keys/admin.pub
```

## Gitignore

This directory is tracked in git, but you can add `.gitignore` if you want to keep keys local:

```
# .gitignore
*.pub
!README.md
```
