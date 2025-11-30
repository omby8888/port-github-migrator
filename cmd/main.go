package main

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
	"github.com/omby8888/port-github-migrator/cmd/commands"
)

const Version = "1.0.0"

func main() {
	// Load .env file
	_ = godotenv.Load()

	rootCmd := commands.NewRootCommand()
	rootCmd.Version = Version

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, "Error:", err)
		os.Exit(1)
	}
}

