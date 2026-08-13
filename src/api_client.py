"""Cliente da API FamilySearch com autenticação OAuth 2.0 (Authorization Code + PKCE)."""

import base64
import hashlib
import http.server
import json
import secrets
import threading
import urllib.parse
import webbrowser
from pathlib import Path
from typing import Optional

import requests

ENVIRONMENTS = {
    "production": {
        "auth_base": "https://ident.familysearch.org",
        "api_base": "https://api.familysearch.org",
    },
    "beta": {
        "auth_base": "https://identbeta.familysearch.org",
        "api_base": "https://apibeta.familysearch.org",
    },
}

DEFAULT_TOKEN_FILE = Path.home() / ".familysearch" / "token.json"


class FamilySearchAuthError(Exception):
    """Erro durante o fluxo de autenticação OAuth 2.0."""


class _CallbackHandler(http.server.BaseHTTPRequestHandler):
    """Captura o redirect do provedor OAuth com o authorization code."""

    def do_GET(self):
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        self.server.auth_code = params.get("code", [None])[0]
        self.server.auth_state = params.get("state", [None])[0]
        self.server.auth_error = params.get("error", [None])[0]

        self.send_response(200)
        self.send_header("Content-type", "text/html; charset=utf-8")
        self.end_headers()
        message = (
            "Autenticação concluída. Você já pode fechar esta janela."
            if self.server.auth_code
            else "Falha na autenticação. Você pode fechar esta janela."
        )
        self.wfile.write(f"<html><body>{message}</body></html>".encode("utf-8"))

    def log_message(self, format, *args):
        pass


class FamilySearchClient:
    """Cliente OAuth 2.0 + wrapper HTTP para a API do FamilySearch.

    Requer um client_id de aplicativo público registrado no
    FamilySearch Developer Portal (https://www.familysearch.org/developers/).
    """

    def __init__(
        self,
        client_id: str,
        redirect_uri: str = "http://localhost:8765/callback",
        environment: str = "production",
        token_file: "str | Path" = DEFAULT_TOKEN_FILE,
    ):
        if environment not in ENVIRONMENTS:
            raise ValueError(f"Ambiente inválido: {environment!r}. Use um de {list(ENVIRONMENTS)}.")

        self.client_id = client_id
        self.redirect_uri = redirect_uri
        self.auth_base = ENVIRONMENTS[environment]["auth_base"]
        self.api_base = ENVIRONMENTS[environment]["api_base"]
        self.token_file = Path(token_file)
        self.session = requests.Session()
        self._token: Optional[dict] = self._load_token()

    # ---- PKCE ----

    @staticmethod
    def _generate_pkce_pair():
        verifier = base64.urlsafe_b64encode(secrets.token_bytes(64)).rstrip(b"=").decode("ascii")
        challenge = base64.urlsafe_b64encode(
            hashlib.sha256(verifier.encode("ascii")).digest()
        ).rstrip(b"=").decode("ascii")
        return verifier, challenge

    # ---- Persistência do token ----

    def _load_token(self) -> Optional[dict]:
        if self.token_file.exists():
            return json.loads(self.token_file.read_text())
        return None

    def _save_token(self, token: dict) -> None:
        self.token_file.parent.mkdir(parents=True, exist_ok=True)
        self.token_file.write_text(json.dumps(token))
        self.token_file.chmod(0o600)
        self._token = token

    # ---- Fluxo OAuth 2.0 ----

    def authorize_url(self, state: str, code_challenge: str) -> str:
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
        return f"{self.auth_base}/cis-web/oauth2/v3/authorization?{urllib.parse.urlencode(params)}"

    def login(self, open_browser: bool = True, timeout: int = 180) -> dict:
        """Executa o fluxo Authorization Code + PKCE.

        Abre o navegador para o usuário autorizar o acesso e captura o
        redirect em um servidor HTTP local temporário.
        """
        verifier, challenge = self._generate_pkce_pair()
        state = secrets.token_urlsafe(16)

        parsed = urllib.parse.urlparse(self.redirect_uri)
        server = http.server.HTTPServer((parsed.hostname, parsed.port), _CallbackHandler)
        server.auth_code = None
        server.auth_state = None
        server.auth_error = None
        server.timeout = timeout

        thread = threading.Thread(target=server.handle_request, daemon=True)
        thread.start()

        url = self.authorize_url(state, challenge)
        if open_browser:
            webbrowser.open(url)
        else:
            print(f"Acesse esta URL para autorizar o acesso:\n{url}")

        thread.join(timeout=timeout)

        if server.auth_error:
            raise FamilySearchAuthError(f"Erro na autorização: {server.auth_error}")
        if not server.auth_code:
            raise FamilySearchAuthError("Tempo esgotado aguardando a autorização do usuário.")
        if server.auth_state != state:
            raise FamilySearchAuthError("Parâmetro 'state' não confere; possível interferência externa.")

        return self._exchange_code(server.auth_code, verifier)

    def _exchange_code(self, code: str, code_verifier: str) -> dict:
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "code_verifier": code_verifier,
        }
        return self._request_token(data)

    def refresh(self) -> dict:
        if not self._token or "refresh_token" not in self._token:
            raise FamilySearchAuthError("Nenhum refresh_token disponível. Faça login novamente com login().")
        data = {
            "grant_type": "refresh_token",
            "refresh_token": self._token["refresh_token"],
            "client_id": self.client_id,
        }
        return self._request_token(data)

    def _request_token(self, data: dict) -> dict:
        response = self.session.post(
            f"{self.auth_base}/cis-web/oauth2/v3/token",
            data=data,
            headers={"Accept": "application/json"},
        )
        if not response.ok:
            raise FamilySearchAuthError(f"Falha ao obter token ({response.status_code}): {response.text}")
        token = response.json()
        self._save_token(token)
        return token

    def ensure_authenticated(self, open_browser: bool = True) -> None:
        """Garante um access_token válido: tenta refresh e cai para login() se necessário."""
        if self._token:
            try:
                self.refresh()
                return
            except FamilySearchAuthError:
                pass
        self.login(open_browser=open_browser)

    @property
    def access_token(self) -> str:
        if not self._token:
            raise FamilySearchAuthError("Sem token de acesso. Chame login() ou ensure_authenticated() primeiro.")
        return self._token["access_token"]

    def logout(self) -> None:
        """Remove o token salvo localmente."""
        self._token = None
        if self.token_file.exists():
            self.token_file.unlink()

    # ---- Chamadas à API ----

    def _request(self, method: str, path: str, headers: Optional[dict] = None, **kwargs) -> dict:
        url = path if path.startswith("http") else f"{self.api_base}{path}"
        request_headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/x-fs-v1+json",
            **(headers or {}),
        }
        response = self.session.request(method, url, headers=request_headers, **kwargs)
        if response.status_code == 401:
            self.refresh()
            request_headers["Authorization"] = f"Bearer {self.access_token}"
            response = self.session.request(method, url, headers=request_headers, **kwargs)
        response.raise_for_status()
        return response.json()

    def get(self, path: str, **kwargs) -> dict:
        return self._request("GET", path, **kwargs)

    def post(self, path: str, **kwargs) -> dict:
        return self._request("POST", path, **kwargs)

    def current_user(self) -> dict:
        """Atalho para /platform/users/current, útil para validar a autenticação."""
        return self.get("/platform/users/current")


if __name__ == "__main__":
    import os

    client_id = os.environ.get("FAMILYSEARCH_CLIENT_ID")
    if not client_id:
        raise SystemExit("Defina a variável de ambiente FAMILYSEARCH_CLIENT_ID antes de executar.")

    client = FamilySearchClient(client_id=client_id, environment=os.environ.get("FAMILYSEARCH_ENV", "production"))
    client.ensure_authenticated()
    print(json.dumps(client.current_user(), indent=2, ensure_ascii=False))
