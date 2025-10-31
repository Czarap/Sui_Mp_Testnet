function Footer() {
    return (
        <footer className="app-footer">
            <div className="container footer-inner">
                <p className="muted">Built on Sui. © {new Date().getFullYear()}</p>
                <div className="footer-links">
                    <a className="nav-link" href="#about">About</a>
                    <a className="nav-link" href="#docs">Docs</a>
                    <a className="nav-link" href="#support">Support</a>
                </div>
            </div>
        </footer>
    );
}

export default Footer;


