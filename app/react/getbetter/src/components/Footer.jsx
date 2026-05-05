function Footer() {
  return (
    <footer style={styles.footer}>
      <p>Mi proyecto Django + React</p>
      <p>TD {new Date().getFullYear()} - Hecho por mí, el increíble magnánimo y poderoso yo</p>
    </footer>
  )
}

const styles = {
  footer: {
    marginTop: "40px",
    textAlign: "center",
    padding: "20px",
    backgroundColor: "#111",
    color: "white",
    position: "relative",
    bottom: 0,
    width: "100%",
  }
}

export default Footer