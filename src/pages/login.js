export function renderLogin() {
  return `
    <div class="login-wrap">
      <div class="login-box">
        <div class="login-logo">
          <svg width="54" height="54" viewBox="0 0 48 48" fill="none" style="margin:0 auto 12px;display:block">
            <circle cx="24" cy="24" r="22" fill="rgba(200,134,10,.1)"/>
            <circle cx="24" cy="24" r="13" fill="rgba(200,134,10,.2)"/>
            <circle cx="24" cy="24" r="6" fill="#c8860a"/>
          </svg>
          <h1>Spitz Lineage</h1>
          <p>Gestão Genética de Elite</p>
        </div>
        <form id="login-form">
          <div class="form-group">
            <label class="form-label">E-mail</label>
            <input class="form-input" type="email" name="email"
              placeholder="seu@email.com" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label class="form-label">Senha</label>
            <input class="form-input" type="password" name="password"
              placeholder="••••••••" required autocomplete="current-password" />
          </div>
          <p id="login-error" style="color:#ff8888;font-size:.85rem;margin-bottom:10px;min-height:18px"></p>
          <button type="submit" class="btn btn-primary btn-full">Entrar</button>
        </form>
        <p style="margin-top:20px;text-align:center;font-size:.8rem;color:var(--text-dim)">
          Acesso exclusivo para clientes cadastrados.
        </p>
      </div>
    </div>`;
}
