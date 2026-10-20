"""Vérification du GPU NVIDIA avant l'entraînement, sans téléchargement."""
import sys
import torch


def main():
    print('Python :', sys.executable)
    print('PyTorch :', torch.__version__)
    print('CUDA du paquet :', torch.version.cuda)
    if not torch.cuda.is_available():
        raise SystemExit('GPU CUDA indisponible. Vérifier le pilote NVIDIA et installer le paquet PyTorch cu128 du guide.')
    print('GPU :', torch.cuda.get_device_name(0))
    print('VRAM (Gio) :', round(torch.cuda.get_device_properties(0).total_memory / 1024**3, 1))
    print('Capacité CUDA :', torch.cuda.get_device_capability(0))
    x = torch.randn(256, 256, device='cuda', requires_grad=True)
    loss = (x @ x.T).square().mean()
    loss.backward()
    torch.cuda.synchronize()
    if x.grad is None or not torch.isfinite(x.grad).all().item():
        raise SystemExit('Échec du calcul de gradients CUDA.')
    print('Calcul matriciel et gradients CUDA : OK. Le notebook peut être lancé.')


if __name__ == '__main__':
    main()
