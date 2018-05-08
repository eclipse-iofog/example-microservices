## Build with version number for test purposes
build:
	sudo docker build -t iofog/temperature-sensor-simulator:$(TAG) .
## Push with version number for test purposes
push:build
    sudo docker push iofog/temperature-sensor-simulator:$(TAG)
## Tag latest to verified version number
latest:
    sudo docker tag iofog/temperature-sensor-simulator:$(TAG) iofog/temperature-sensor-simulator
## Push latest
push-latest:latest
    sudo docker push iofog/temperature-sensor-simulator

## Same cmds for arm
build-arm:
    sudo docker build -t iofog/temperature-sensor-simulator-arm:$(TAG) -f Dockerfile-arm .
push-arm:build-arm
    sudo docker push iofog/temperature-sensor-simulator-arm:$(TAG)
latest-arm:
    sudo docker tag iofog/temperature-sensor-simulator-arm:$(TAG) iofog/temperature-sensor-simulator-arm
push-latest-arm:latest-arm
    sudo docker push iofog/temperature-sensor-simulator-arm
