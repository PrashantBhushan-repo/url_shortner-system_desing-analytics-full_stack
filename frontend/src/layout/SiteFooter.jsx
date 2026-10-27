import { Link } from 'react-router-dom';
export default function SiteFooter() {
  return <footer className="site-footer"><span>© {new Date().getFullYear()} PBUrls · Your links and insights</span><div><Link to="/">Website</Link><Link to="/pricing">Plans</Link><Link to="/help">Help & guides</Link></div></footer>;
}
