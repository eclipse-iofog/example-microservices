## Build with version number for test purposes
build:
	sudo docker build -t iofog/temperature-conversion:$(TAG) .
## Push with version number for test purposes
push:build
    sudo docker push iofog/temperature-conversion:$(TAG)
## Tag latest to verified version number
latest:
    sudo docker tag iofog/temperature-conversion:$(TAG) iofog/temperature-conversion
## Push latest
push-latest:latest
    sudo docker push iofog/temperature-conversion

## Same cmds for arm
build-arm:
    sudo docker build -t iofog/temperature-conversion-arm:$(TAG) -f Dockerfile-arm .
push-arm:build-arm
    sudo docker push iofog/temperature-conversion-arm:$(TAG)
latest-arm:
    sudo docker tag iofog/temperature-conversion-arm:$(TAG) iofog/temperature-conversion-arm
push-latest-arm:latest-arm
    sudo docker push iofog/temperature-conversion-arm