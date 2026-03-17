package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	AppPort       string
	DBHost        string
	DBPort        string
	DBUser        string
	DBPassword    string
	DBName        string
	AllowedOrigin string
}

func Load() (Config, error) {
	_ = godotenv.Load(".env", "backend/.env")

	cfg := Config{
		AppPort:       getEnv("APP_PORT", "8080"),
		DBHost:        os.Getenv("DB_HOST"),
		DBPort:        getEnv("DB_PORT", "3306"),
		DBUser:        os.Getenv("DB_USER"),
		DBPassword:    os.Getenv("DB_PASSWORD"),
		DBName:        os.Getenv("DB_NAME"),
		AllowedOrigin: getEnv("ALLOWED_ORIGIN", "*"),
	}

	if err := cfg.validate(); err != nil {
		return Config{}, err
	}

	return cfg, nil
}

func (c Config) DSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&loc=UTC", c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName)
}

func (c Config) validate() error {
	if c.DBHost == "" || c.DBUser == "" || c.DBPassword == "" || c.DBName == "" {
		return fmt.Errorf("missing required database environment variables")
	}
	if _, err := strconv.Atoi(c.DBPort); err != nil {
		return fmt.Errorf("invalid DB_PORT: %w", err)
	}
	return nil
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
