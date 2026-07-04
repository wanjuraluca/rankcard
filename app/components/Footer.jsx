export default function Footer() {
    return (
        <footer className="relative z-10 mt-auto flex w-full flex-wrap items-center justify-center gap-4 border-t border-hairline px-8 py-6 text-xs text-text-muted">
            <span>© {new Date().getFullYear()} RankCard</span>
            <a href="/impressum" className="hover:text-white transition-colors">Legal Notice</a>
            <a href="/datenschutz" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="/agb" className="hover:text-white transition-colors">Terms</a>
        </footer>
    )
}
